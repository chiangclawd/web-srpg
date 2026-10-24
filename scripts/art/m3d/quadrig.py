# 四足動物自動綁骨架 + 程式動作（Meshy 的自動綁骨架只支援人形）
#
# 用法（需要 Blender 的 Python 模組，裝在獨立 venv：python3 -m venv .venv-bpy && .venv-bpy/bin/pip install bpy==5.2.3）：
#   .venv-bpy/bin/python -I scripts/art/m3d/quadrig.py -- <in.glb> <out.glb> [config.json]
#
# 輸入：Meshy 圖轉 3D（MESHY_POSE=none）+ 減面後的 GLB，頭朝 glTF +Z（Blender -Y）、Z 朝上。
# 流程：
#   1. 從網格形狀找地標：貼地的四團頂點 = 四隻腳掌，沿著腿往上追到肚子 = 腿的關節，
#      背脊高度剖面 = 脊椎，最前端 = 頭，後腿後方 = 尾巴
#   2. 建骨架（Hips 在骨盆、脊椎 3 節、脖子、頭、尾巴 3 節、每條腿 3 節）
#   3. 權重：網格合併接縫頂點後用 Blender 的自動權重（bone heat），再轉回原網格（保留 UV）
#   4. 用程式關鍵影格做 idle / walk（對角小跑）/ attack（撲咬）/ hit / death（側倒）
#   5. 匯出 GLB：每個動作一段 glTF 動畫，交給 render.mjs 渲染成逐格圖表
#
# 骨頭命名配合 render.html：Hips（鎖水平位移）、Foot.*（量步幅算 cycle）。
import bpy, sys, json, math, collections
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
cfg = json.load(open(args[2])) if len(args) > 2 else {}
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# 有些模型的父物件帶旋轉，套用後清掉多餘的空物件
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o)

ws = [v.co.copy() for v in body.data.vertices]
xmn, xmx = min(w.x for w in ws), max(w.x for w in ws)
ymn, ymx = min(w.y for w in ws), max(w.y for w in ws)
zmn, zmx = min(w.z for w in ws), max(w.z for w in ws)
L, H = ymx - ymn, zmx - zmn
print(f'size L={L:.3f} H={H:.3f} W={xmx - xmn:.3f}')

# 騎士（騎兵、獅鷲騎士）：設定給一或多個方框，y = 從頭到尾的比例、z = 從地面往上的比例、
# x（可省略）= 從右到左的比例。框內頂點整塊綁在 Rider 骨頭上（跟著馬背走，出招時自己往前揮），
# 找坐騎地標時不看這些頂點。武器伸出身體外的部分另外框一個。
RB = cfg.get('rider')
BOXES = RB if isinstance(RB, list) else [RB] if RB else []
W = xmx - xmn


def in_box(w, b):
    fy, fz, fx = (w.y - ymn) / L, (w.z - zmn) / H, (w.x - xmn) / W
    return b['y'][0] <= fy <= b['y'][1] and fz >= b['z'] and b.get('x', [0, 1])[0] <= fx <= b.get('x', [0, 1])[1]


def in_rider(w):
    return any(in_box(w, b) for b in BOXES)


# 翅膀（獅鷲）：設定給左右兩個方框（座標同上），框內頂點綁在 Wing 骨頭上拍動。左邊是 +X（頭朝 -Y）。
WB = cfg.get('wings', {})


def wing_side(w):
    if in_rider(w):
        return None
    for side in ('L', 'R'):
        if side in WB and in_box(w, WB[side]):
            return side
    return None


rider_pts = [w for w in ws if in_rider(w)]
wing_pts = {side: [w for w in ws if wing_side(w) == side] for side in WB}
ws = [w for w in ws if not in_rider(w) and not wing_side(w)]
if BOXES:
    print('rider verts', len(rider_pts))
for side, pts in wing_pts.items():
    print(f'wing {side} verts', len(pts))


def components(pts, cell):
    """XY 平面上相連的頂點團"""
    occ = collections.defaultdict(list)
    for p in pts:
        occ[(math.floor(p.x / cell), math.floor(p.y / cell))].append(p)
    seen, comps = set(), []
    for k in occ:
        if k in seen:
            continue
        stack, comp = [k], []
        seen.add(k)
        while stack:
            c = stack.pop()
            comp += occ[c]
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (c[0] + dx, c[1] + dy)
                    if n in occ and n not in seen:
                        seen.add(n)
                        stack.append(n)
        comps.append(comp)
    return sorted(comps, key=len, reverse=True)


def centroid(pts):
    s = Vector()
    for p in pts:
        s += p
    return s / max(1, len(pts))


# ---- 1. 地標 ----
# 腳掌：貼地的頂點分成四團（抬起的腳也算，只要比肚子低）
feet = None
for frac in cfg.get('footFracs', [0.12, 0.1, 0.15, 0.08, 0.18, 0.2]):
    comps = [c for c in components([w for w in ws if w.z < zmn + H * frac], 0.015 * L) if len(c) > 20]
    if len(comps) >= 4:
        feet = comps[:4]
        break
if not feet:
    raise SystemExit('找不到四隻腳')
foot_c = [centroid(c) for c in feet]
ymid = sum(c.y for c in foot_c) / 4
legs = {}
for c, pts in zip(foot_c, feet):
    fb = 'F' if c.y < ymid else 'H'  # 頭朝 -Y
    legs.setdefault(fb, []).append((c, pts))
if len(legs.get('F', [])) != 2:
    # 四隻腳的 y 分不成兩兩一組：照 y 排序硬分
    srt = sorted(zip(foot_c, feet), key=lambda t: t[0].y)
    legs = {'F': srt[:2], 'H': srt[2:]}
LEG = {}
for fb in 'FH':
    a, b = sorted(legs[fb], key=lambda t: t[0].x)
    # 朝 -Y 時左邊是 +X
    LEG[fb + 'R'], LEG[fb + 'L'] = a, b

# 肚子高度：前後腿之間那段身體的底部
yf = max(LEG['FL'][0].y, LEG['FR'][0].y)
yh = min(LEG['HL'][0].y, LEG['HR'][0].y)
mid = [w for w in ws if yf + 0.15 * (yh - yf) < w.y < yh - 0.15 * (yh - yf) and abs(w.x) < 0.15 * L]
belly = sorted(w.z for w in mid)[max(0, len(mid) // 50)] if mid else zmn + 0.4 * H


def top_at(y, half=0.03):
    sl = [w.z for w in ws if abs(w.y - y) < half * L and abs(w.x) < 0.06 * L]
    return max(sl) if sl else belly + 0.3 * H


def spine_z(y):
    return (top_at(y) + belly) / 2


def trace_leg(pts):
    """從腳掌沿著腿往上追，每一層取附近頂點的中心，追到肚子為止"""
    lowest = sorted(pts, key=lambda p: p.z)
    c = centroid(lowest[: max(5, len(lowest) // 3)])
    z0 = lowest[0].z
    path = [Vector((c.x, c.y, z0))]
    step = 0.025 * H
    r = 0.06 * L
    z = z0 + step
    while z < belly:
        sl = [w for w in ws if abs(w.z - z) < step and (Vector((w.x, w.y)) - Vector((c.x, c.y))).length < r]
        if not sl:
            break
        n = centroid(sl)
        c = Vector((c.x * 0.3 + n.x * 0.7, c.y * 0.3 + n.y * 0.7, z))
        path.append(c.copy())
        z += step
    return path


def along(path, t):
    """折線上依高度比例取點"""
    z = path[0].z + (path[-1].z - path[0].z) * t
    for a, b in zip(path, path[1:]):
        if a.z <= z <= b.z:
            k = (z - a.z) / max(1e-6, b.z - a.z)
            return a.lerp(b, k)
    return path[-1].copy()


J = {}
for k, (c, pts) in LEG.items():
    path = trace_leg(pts)
    top = path[-1]
    sz = spine_z(top.y)
    J[k] = {
        # 肩 / 髖關節埋在身體裡（肚子往上 4 成）
        'top': Vector((top.x * 0.7, top.y, belly + 0.4 * (sz - belly) + 0.2 * (sz - belly))),
        'knee': along(path, 0.55),
        'ankle': along(path, 0.16),
        'toe': Vector((path[0].x, path[0].y - 0.035 * L, path[0].z)),
        'ground': path[0].z,
    }
    print(k, 'foot', tuple(round(v, 3) for v in path[0]), 'top', tuple(round(v, 3) for v in J[k]['top']), 'pts', len(path))

shoulder_y = (J['FL']['top'].y + J['FR']['top'].y) / 2
hip_y = (J['HL']['top'].y + J['HR']['top'].y) / 2
# 頭：最前端；頭長約全長 17%
snout = min(ws, key=lambda w: w.y)
head_len = cfg.get('headLen', 0.17) * L
head_base = Vector((0, ymn + head_len, 0))
head_base.z = spine_z(head_base.y)
neck_base = Vector((0, shoulder_y - 0.02 * L, spine_z(shoulder_y) + 0.05 * H))
P = {
    'hips': Vector((0, hip_y, spine_z(hip_y))),
    'spine1': Vector((0, hip_y + (shoulder_y - hip_y) * 0.33, spine_z(hip_y + (shoulder_y - hip_y) * 0.33))),
    'spine2': Vector((0, hip_y + (shoulder_y - hip_y) * 0.66, spine_z(hip_y + (shoulder_y - hip_y) * 0.66))),
    'chest': Vector((0, shoulder_y, spine_z(shoulder_y))),
    'neck': neck_base,
    'head': head_base,
    'snout': Vector((0, snout.y, snout.z)),
}
# 尾巴：後腿後方、比肚子高的頂點，沿 y 分段取中心
tail_pts = [w for w in ws if w.y > hip_y + 0.08 * L and w.z > belly - 0.05 * H]
tail = []
if tail_pts:
    ty0, ty1 = hip_y + 0.08 * L, max(w.y for w in tail_pts)
    for i in range(4):
        y = ty0 + (ty1 - ty0) * i / 3
        sl = [w for w in tail_pts if abs(w.y - y) < 0.04 * L]
        if sl:
            c = centroid(sl)
            tail.append(Vector((0, y, c.z)))
print('belly', round(belly, 3), 'hips', tuple(round(v, 3) for v in P['hips']), 'chest', tuple(round(v, 3) for v in P['chest']), 'tail', len(tail))

# ---- 2. 骨架 ----
arm_data = bpy.data.armatures.new('Armature')
arm = bpy.data.objects.new('Armature', arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
UP, FWD = Vector((0, 0, 1)), Vector((0, -1, 0))


def bone(name, head, tail_, parent=None, roll_to=UP, connect=False):
    b = eb.new(name)
    b.head, b.tail = head, tail_
    b.align_roll(roll_to)
    if parent:
        b.parent = eb[parent]
        b.use_connect = connect
    return b


# Hips 往前指（跟脊椎同方向），是整副骨架的根
bone('Hips', P['hips'], P['spine1'])
bone('Spine', P['spine1'], P['spine2'], 'Hips', connect=True)
bone('Spine1', P['spine2'], P['chest'], 'Spine', connect=True)
bone('Neck', P['chest'], P['head'], 'Spine1', connect=True)
bone('Head', P['head'], P['snout'], 'Neck', connect=True)
prev = 'Hips'
if len(tail) >= 2:
    chain = [P['hips'].lerp(tail[0], 0.5)] + tail
    for i, (a, b) in enumerate(zip(chain, chain[1:])):
        name = f'Tail{i}'
        bone(name, a, b, prev, connect=i > 0)
        prev = name
for k, j in J.items():
    par = 'Spine1' if k[0] == 'F' else 'Hips'
    # 腿往下指：區域 Z 軸朝前，繞區域 X 轉 = 前後擺
    bone(f'UpperLeg.{k}', j['top'], j['knee'], par, roll_to=FWD)
    bone(f'LowerLeg.{k}', j['knee'], j['ankle'], f'UpperLeg.{k}', roll_to=FWD, connect=True)
    bone(f'Foot.{k}', j['ankle'], j['toe'], f'LowerLeg.{k}', roll_to=FWD, connect=True)
if rider_pts:
    # 騎士往上指：區域 Z 朝前，繞區域 X 轉 = 前傾、繞區域 Y 轉 = 扭身
    rc = centroid(rider_pts)
    bone('Rider', Vector((0, rc.y, zmn + BOXES[0]['z'] * H)), Vector((0, rc.y, max(w.z for w in rider_pts))), 'Spine', roll_to=FWD)
WING_TIP = {}
for side, pts in wing_pts.items():
    # 翅根 = 最靠身體中線的那群頂點（往身體裡收一點）；翅尖 = 離翅根最遠的頂點；中間一節在一半距離處
    inner = sorted(pts, key=lambda w: abs(w.x))[: max(10, len(pts) // 20)]
    root = centroid(inner)
    root.x *= 0.5
    tip = max(pts, key=lambda w: (w - root).length)
    d = (tip - root).length
    ring = [w for w in pts if 0.4 * d < (w - root).length < 0.6 * d]
    mid = centroid(ring) if ring else root.lerp(tip, 0.5)
    # 區域 Z 軸朝前：繞區域 Z 轉 = 上下拍
    bone(f'Wing1.{side}', root, mid, 'Spine1', roll_to=FWD)
    bone(f'Wing2.{side}', mid, tip, f'Wing1.{side}', roll_to=FWD, connect=True)
    WING_TIP[side] = tip
    print(f'wing {side} root', tuple(round(v, 3) for v in root), 'tip', tuple(round(v, 3) for v in tip))
bpy.ops.object.mode_set(mode='OBJECT')

# ---- 3. 權重：合併接縫頂點的代理網格算 bone heat，再轉給原網格 ----
bpy.ops.object.select_all(action='DESELECT')
proxy = body.copy()
proxy.data = body.data.copy()
bpy.context.scene.collection.objects.link(proxy)
bpy.context.view_layer.objects.active = proxy
proxy.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0005 * L)
bpy.ops.object.mode_set(mode='OBJECT')
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
ok_groups = sum(1 for g in proxy.vertex_groups)
print('proxy verts', len(proxy.data.vertices), 'groups', ok_groups)
# 轉權重
bpy.ops.object.select_all(action='DESELECT')
for b in arm_data.bones:
    body.vertex_groups.new(name=b.name)
dt = body.modifiers.new('wt', 'DATA_TRANSFER')
dt.object = proxy
dt.use_vert_data = True
dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'NEAREST'
bpy.context.view_layer.objects.active = body
bpy.ops.object.datalayout_transfer(modifier='wt')
bpy.ops.object.modifier_apply(modifier='wt')
bpy.data.objects.remove(proxy)
if rider_pts:
    # 騎士整塊只跟 Rider 骨頭；坐騎不受 Rider 影響
    rid = [v.index for v in body.data.vertices if in_rider(v.co)]
    non = [v.index for v in body.data.vertices if not in_rider(v.co)]
    for g in body.vertex_groups:
        if g.name != 'Rider':
            g.remove(rid)
    body.vertex_groups['Rider'].remove(non)
    body.vertex_groups['Rider'].add(rid, 1.0, 'REPLACE')
if wing_pts:
    # 翅膀頂點只跟同一邊的翅膀骨頭；身體其他部分不受翅膀骨頭影響
    for side in wing_pts:
        names = (f'Wing1.{side}', f'Wing2.{side}')
        mine = [v.index for v in body.data.vertices if wing_side(v.co) == side]
        for g in body.vertex_groups:
            if g.name not in names:
                g.remove(mine)
        others = [v.index for v in body.data.vertices if wing_side(v.co) != side]
        for n in names:
            body.vertex_groups[n].remove(others)
        # bone heat 沒給到的翅膀頂點：照離翅根的距離分給兩節
        b1 = arm_data.bones[names[0]]
        for i in mine:
            v = body.data.vertices[i]
            if sum(g.weight for g in v.groups) < 1e-3:
                k = min(1.0, (v.co - b1.head_local).length / max(1e-6, (WING_TIP[side] - b1.head_local).length))
                body.vertex_groups[names[0]].add([i], 1 - k, 'REPLACE')
                body.vertex_groups[names[1]].add([i], k, 'REPLACE')
# 沒拿到權重的頂點（bone heat 偶爾漏掉的小碎片）給最近的骨頭（騎士、翅膀骨頭除外）
bones_mid = {b.name: (b.head_local + b.tail_local) / 2 for b in arm_data.bones if b.name != 'Rider' and not b.name.startswith('Wing')}
gi = {g.name: g.index for g in body.vertex_groups}
fixed = 0
for v in body.data.vertices:
    if sum(g.weight for g in v.groups) < 1e-3:
        near = min(bones_mid, key=lambda n: (bones_mid[n] - v.co).length)
        body.vertex_groups[gi[near]].add([v.index], 1.0, 'REPLACE')
        fixed += 1
print('unweighted verts fixed', fixed)
body.parent = arm
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = arm

# ---- 4. 程式動作 ----
pb = arm.pose.bones
for p in pb:
    p.rotation_mode = 'XYZ'
TAU = 2 * math.pi
legs_k = [k for k in J]
# 對角小跑：左前+右後一組、右前+左後一組
PHASE = {'FL': 0.0, 'HR': 0.0, 'FR': 0.5, 'HL': 0.5}
S = cfg.get('swing', 1.3)
# 倒向哪一側：1 = 腳朝鏡頭（側面看得到四條腿），-1 = 背朝鏡頭
ROLL = cfg.get('deathRoll', 1)


def rider(lean=0.0, twist=0.0):
    if 'Rider' in pb:
        pb['Rider'].rotation_euler.x = lean
        pb['Rider'].rotation_euler.y = twist


def reset():
    for p in pb:
        p.rotation_euler = (0, 0, 0)
        p.location = (0, 0, 0)


def key_all(f):
    for p in pb:
        p.keyframe_insert('rotation_euler', frame=f)
        if p.name == 'Hips':
            p.keyframe_insert('location', frame=f)


def pose_walk(t):
    for k in legs_k:
        ph = TAU * (t + PHASE[k])
        front = k[0] == 'F'
        pb[f'UpperLeg.{k}'].rotation_euler.x = S * (0.42 if front else 0.36) * math.sin(ph)
        # 往前收腿（擺動期）時膝蓋彎起來
        lift = max(0.0, math.cos(ph))
        pb[f'LowerLeg.{k}'].rotation_euler.x = S * (-0.75 if front else 0.75) * lift * (0.6 if front else 0.5)
        pb[f'Foot.{k}'].rotation_euler.x = S * (0.5 if front else -0.4) * lift
    bob = math.sin(TAU * 2 * t)
    # Hips 的區域 Y 軸 = 骨頭方向（往前），上下用區域 Z
    pb['Hips'].location = (0, 0, 0.02 * H * bob)
    pb['Hips'].rotation_euler.y = 0.04 * math.sin(TAU * t)
    pb['Spine1'].rotation_euler.z = 0.05 * math.sin(TAU * t)
    pb['Neck'].rotation_euler.x = -0.06 * bob
    # 騎士抵銷一點身體起伏，看起來坐得穩
    rider(0.03 * bob, 0.04 * math.sin(TAU * t))
    for i in range(4):
        n = f'Tail{i}'
        if n in pb:
            pb[n].rotation_euler.z = 0.18 * math.sin(TAU * t - i * 0.6)
            pb[n].rotation_euler.x = 0.05


def pose_idle(t):
    br = math.sin(TAU * t)
    pb['Spine'].rotation_euler.x = 0.025 * br
    pb['Spine1'].rotation_euler.x = -0.03 * br
    pb['Neck'].rotation_euler.z = 0.12 * math.sin(TAU * t + 0.8)
    pb['Head'].rotation_euler.x = 0.04 * br
    rider(0.02 * br, 0.05 * math.sin(TAU * t + 0.4))
    for i in range(4):
        n = f'Tail{i}'
        if n in pb:
            pb[n].rotation_euler.z = 0.12 * math.sin(TAU * 2 * t - i * 0.7)


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def pose_attack(t):
    # 0~0.35 蓄力（壓低、頭往後收）→ 0.35~0.55 撲咬（伸長、前腳往前）→ 收回
    wind = ease(t / 0.35) * (1 - ease((t - 0.35) / 0.15))
    strike = ease((t - 0.35) / 0.2) * (1 - ease((t - 0.7) / 0.3))
    pb['Hips'].location = (0, 0, (-0.06 * wind + 0.03 * strike) * H)
    pb['Hips'].rotation_euler.x = -0.08 * wind + 0.06 * strike
    pb['Spine1'].rotation_euler.x = -0.1 * wind + 0.12 * strike
    pb['Neck'].rotation_euler.x = 0.25 * wind - 0.35 * strike
    pb['Head'].rotation_euler.x = 0.1 * wind - 0.25 * strike
    # 騎士：往後拉、扭身蓄力 → 往前揮砍
    rider(-0.18 * wind + 0.32 * strike, 0.35 * wind - 0.45 * strike)
    for k in legs_k:
        front = k[0] == 'F'
        pb[f'UpperLeg.{k}'].rotation_euler.x = (0.2 * wind + 0.45 * strike) if front else (-0.25 * wind - 0.2 * strike)
        pb[f'LowerLeg.{k}'].rotation_euler.x = (-0.3 * wind - 0.2 * strike) if front else (0.35 * wind)
    for i in range(4):
        n = f'Tail{i}'
        if n in pb:
            pb[n].rotation_euler.x = 0.2 * strike + 0.1


def pose_hit(t):
    k = math.sin(math.pi * min(1.0, t / 0.9))
    pb['Hips'].location = (0, 0, -0.03 * H * k)
    pb['Spine1'].rotation_euler.x = 0.1 * k
    pb['Neck'].rotation_euler.x = 0.3 * k
    pb['Head'].rotation_euler.x = 0.2 * k
    rider(-0.22 * k)
    for lk in legs_k:
        pb[f'UpperLeg.{lk}'].rotation_euler.x = (-0.15 if lk[0] == 'F' else 0.12) * k


def pose_death(t):
    # 往側邊倒下：繞身體長軸轉 90 度，降到地面，腿放鬆、頭垂下
    fall = ease(t / 0.55)
    settle = ease((t - 0.5) / 0.5)
    pb['Hips'].rotation_euler.y = ROLL * 1.45 * fall
    pb['Hips'].location = (0, 0, -(spine_z(hip_y) - zmn - 0.22 * (xmx - xmn)) * fall)
    pb['Neck'].rotation_euler.x = 0.2 * fall - 0.15 * settle
    pb['Head'].rotation_euler.x = 0.25 * settle
    rider(0.35 * fall)
    for lk in legs_k:
        front = lk[0] == 'F'
        pb[f'UpperLeg.{lk}'].rotation_euler.x = (0.3 if front else -0.3) * settle
        pb[f'LowerLeg.{lk}'].rotation_euler.x = (-0.4 if front else 0.4) * settle
    for i in range(4):
        n = f'Tail{i}'
        if n in pb:
            pb[n].rotation_euler.z = -0.2 * settle


# ---- 飛行單位（獅鷲）：walk = 拍翅飛行、idle = 滑翔，腿一直收著 ----
FLAP = cfg.get('flap', 0.6)
# 翅膀骨頭的區域 Z 朝前：左翅繞 Z 正轉 = 往上，右翅鏡像
WSIGN = {'L': 1, 'R': -1}


def wings(a1, a2):
    for side in wing_pts:
        pb[f'Wing1.{side}'].rotation_euler.z = WSIGN[side] * a1
        pb[f'Wing2.{side}'].rotation_euler.z = WSIGN[side] * a2


def tuck(k=1.0):
    # 前腳往前彎、後腳往後拖
    for lk in legs_k:
        front = lk[0] == 'F'
        pb[f'UpperLeg.{lk}'].rotation_euler.x += (0.45 if front else -0.5) * k
        pb[f'LowerLeg.{lk}'].rotation_euler.x += (-0.9 if front else 0.55) * k


def tail_sway(t, amp=0.12):
    for i in range(4):
        n = f'Tail{i}'
        if n in pb:
            pb[n].rotation_euler.z = amp * math.sin(TAU * t - i * 0.6)
            pb[n].rotation_euler.x = 0.1


def pose_fly(t):
    ph = TAU * t
    # 翅尖比翅根慢一點，拍起來有彈性
    wings(FLAP * math.sin(ph), FLAP * 0.7 * math.sin(ph - 0.8))
    # 下拍時身體被抬起來
    pb['Hips'].location = (0, 0, -0.025 * H * math.cos(ph))
    pb['Hips'].rotation_euler.x = 0.03 * math.sin(ph)
    pb['Neck'].rotation_euler.x = 0.05 * math.sin(ph + 1.2)
    rider(0.03 * math.cos(ph))
    tuck()
    tail_sway(t)


def pose_hover(t):
    ph = TAU * t
    wings(0.25 + FLAP * 0.3 * math.sin(ph), 0.15 + FLAP * 0.25 * math.sin(ph - 0.7))
    pb['Hips'].location = (0, 0, 0.015 * H * math.sin(ph))
    pb['Neck'].rotation_euler.z = 0.1 * math.sin(ph + 0.8)
    pb['Head'].rotation_euler.x = 0.04 * math.sin(ph)
    rider(0.02 * math.sin(ph), 0.05 * math.sin(ph + 0.4))
    tuck()
    tail_sway(t, 0.08)


def pose_fly_attack(t):
    # 翅膀高舉蓄力 → 用力下拍、往前啄、騎士出招 → 收回
    wind = ease(t / 0.35) * (1 - ease((t - 0.35) / 0.15))
    strike = ease((t - 0.35) / 0.2) * (1 - ease((t - 0.7) / 0.3))
    wings(0.9 * wind - 0.5 * strike, 0.6 * wind - 0.3 * strike)
    pb['Hips'].location = (0, 0, (0.03 * wind - 0.02 * strike) * H)
    pb['Hips'].rotation_euler.x = 0.08 * wind - 0.1 * strike
    pb['Neck'].rotation_euler.x = 0.25 * wind - 0.4 * strike
    pb['Head'].rotation_euler.x = 0.1 * wind - 0.25 * strike
    rider(-0.18 * wind + 0.32 * strike, 0.35 * wind - 0.45 * strike)
    tuck()
    # 前爪往前抓
    for lk in legs_k:
        if lk[0] == 'F':
            pb[f'UpperLeg.{lk}'].rotation_euler.x += 0.5 * strike
            pb[f'LowerLeg.{lk}'].rotation_euler.x += 0.6 * strike
    tail_sway(t, 0.1)


def pose_fly_hit(t):
    k = math.sin(math.pi * min(1.0, t / 0.9))
    wings(0.6 * k, 0.4 * k)
    pb['Hips'].rotation_euler.x = 0.12 * k
    pb['Neck'].rotation_euler.x = 0.3 * k
    pb['Head'].rotation_euler.x = 0.2 * k
    rider(-0.22 * k)
    tuck()


def pose_fly_death(t):
    # 翅膀往上收起、身體翻向側邊落地（遊戲裡同時把整隻往地面放）
    fall = ease(t / 0.55)
    settle = ease((t - 0.5) / 0.5)
    wings(1.0 * fall - 0.6 * settle, 0.8 * fall - 0.5 * settle)
    pb['Hips'].rotation_euler.y = ROLL * 1.45 * fall
    pb['Hips'].location = (0, 0, -(spine_z(hip_y) - zmn - 0.22 * (xmx - xmn)) * fall)
    pb['Neck'].rotation_euler.x = 0.2 * fall - 0.15 * settle
    pb['Head'].rotation_euler.x = 0.25 * settle
    rider(0.35 * fall)
    tuck(1 - settle)
    for i in range(4):
        n = f'Tail{i}'
        if n in pb:
            pb[n].rotation_euler.z = -0.2 * settle


FLYER = bool(cfg.get('flyer'))
ANIMS = [
    # 名稱、長度（秒）、循環、姿勢函式
    ('idle', 2.0, True, pose_hover if FLYER else pose_idle),
    ('walk', 1.0, True, pose_fly if FLYER else pose_walk),
    ('attack', 0.8, False, pose_fly_attack if FLYER else pose_attack),
    ('hit', 0.4, False, pose_fly_hit if FLYER else pose_hit),
    ('death', 1.2, False, pose_fly_death if FLYER else pose_death),
]
arm.animation_data_create()
for name, dur, loop, fn in ANIMS:
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    n = round(dur * FPS)
    for f in range(n + 1):
        reset()
        fn(f / n)
        key_all(f + 1)
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, act)
    arm.animation_data.action = None
reset()

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_force_sampling=True,
    export_frame_range=False,
    export_skins=True,
    export_yup=True,
)
print('saved', out, [a.name for a in bpy.data.actions])
