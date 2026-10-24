# 會拍的翅膀：
#   - 已經用 Meshy 綁好人形骨架的模型（惡魔）：在原骨架上加翅膀骨頭，原本每段動作都疊上拍翅
#   - 沒有骨架、也沒有腳的飛行生物（蝙蝠）：綁一副「身體 + 頭 + 左右翅膀」的骨架，做整套飛行動作
#
# 用法（Blender 的 Python 模組，見 NONHUMANOID.md）：
#   .venv-bpy/bin/python -I scripts/art/m3d/wingrig.py -- <in.glb> <out.glb> <config.json>
#
# 設定：
#   wings: {"L": 方框, "R": 方框}  方框 = {"y": [前, 後], "z": 最低, "x": [右, 左]}，都是模型範圍的比例
#                                  （頭朝 -Y、Z 朝上；左邊是 +X）
#   flap: 拍翅幅度（弧度，預設 0.6）  rotateZ: 沒有骨架時先轉正的角度  headLen: 頭占身長比例（預設 0.3）
#   flyFrom: 已綁骨架時，複製哪段動作當成飛行（名稱 Fly，快速拍翅）
#   holdBody: 已綁骨架時，哪些動作的身體停在第一格只拍翅膀（例如 ["Fly", "Idle"]）
import bpy, sys, json, math
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
cfg = json.load(open(args[2]))
FPS = 30
FLAP = cfg.get('flap', 0.6)
TAU = 2 * math.pi

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=src)
arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
RIGGED = arm is not None

if RIGGED:
    # 綁好的角色網格：掛在骨架下面的那個（Meshy 的檔案裡另有一顆沒掛骨架的小球，不動它）
    body = max((o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == arm), key=lambda o: len(o.data.vertices))
    arm.animation_data.action = None
    arm.data.pose_position = 'REST'
else:
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.matrix_world = Matrix.Rotation(math.radians(cfg.get('rotateZ', 0)), 4, 'Z') @ body.matrix_world
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o)

# 綁定姿勢下每個頂點的世界座標
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg).to_mesh()
ws = [body.matrix_world @ v.co for v in ev.vertices]
body.evaluated_get(dg).to_mesh_clear()
xmn, xmx = min(w.x for w in ws), max(w.x for w in ws)
ymn, ymx = min(w.y for w in ws), max(w.y for w in ws)
zmn, zmx = min(w.z for w in ws), max(w.z for w in ws)
W, L, H = xmx - xmn, ymx - ymn, zmx - zmn


def in_box(w, b):
    fy, fz, fx = (w.y - ymn) / L, (w.z - zmn) / H, (w.x - xmn) / W
    return b['y'][0] <= fy <= b['y'][1] and fz >= b['z'] and b.get('x', [0, 1])[0] <= fx <= b.get('x', [0, 1])[1]


SIDE = [next((s for s in ('L', 'R') if s in cfg['wings'] and in_box(w, cfg['wings'][s])), None) for w in ws]
wing_pts = {s: [w for w, sd in zip(ws, SIDE) if sd == s] for s in cfg['wings']}
print('size', round(W, 3), round(L, 3), round(H, 3), {s: len(p) for s, p in wing_pts.items()})


def centroid(pts):
    c = Vector()
    for p in pts:
        c += p
    return c / max(1, len(pts))


# ---- 骨架 ----
if not RIGGED:
    arm = bpy.data.objects.new('Armature', bpy.data.armatures.new('Armature'))
    bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
TO_ARM = arm.matrix_world.inverted()
UP_W = Vector((0, 0, 1))
body_pts = [w for w, sd in zip(ws, SIDE) if sd is None]
if not RIGGED:
    # 身體 = Hips（往前指），頭 = 前段 headLen
    bc = centroid(body_pts)
    front = min(w.y for w in body_pts)
    hl = cfg.get('headLen', 0.3) * (max(w.y for w in body_pts) - front)
    neck = Vector((0, front + hl, bc.z))
    hb = eb.new('Hips')
    hb.head, hb.tail = TO_ARM @ Vector((0, bc.y, bc.z)), TO_ARM @ neck
    hb.align_roll(TO_ARM.to_3x3() @ UP_W)
    head_pts = [w for w in body_pts if w.y < front + hl]
    tip = Vector((0, front, centroid(head_pts).z if head_pts else bc.z))
    nb = eb.new('Head')
    nb.head, nb.tail = TO_ARM @ neck, TO_ARM @ tip
    nb.align_roll(TO_ARM.to_3x3() @ UP_W)
    nb.parent = hb
    nb.use_connect = True
    PARENT = 'Hips'
else:
    PARENT = None
WSIGN = {}
WING = {}
for side, pts in wing_pts.items():
    inner = sorted(pts, key=lambda w: abs(w.x))[: max(10, len(pts) // 20)]
    root = centroid(inner)
    tip = max(pts, key=lambda w: (w - root).length)
    d = (tip - root).length
    ring = [w for w in pts if 0.4 * d < (w - root).length < 0.6 * d]
    mid = centroid(ring) if ring else root.lerp(tip, 0.5)
    if RIGGED and PARENT is None:
        # 掛在離翅根最近的脊椎骨上
        cands = [b for b in eb if 'spine' in b.name.lower()] or list(eb)
        PARENT = min(cands, key=lambda b: (arm.matrix_world @ b.head - root).length).name
    prev = PARENT
    for i, (a, b) in enumerate(((root, mid), (mid, tip))):
        name = f'Wing{i + 1}.{side}'
        e = eb.new(name)
        e.head, e.tail = TO_ARM @ a, TO_ARM @ b
        # 區域 Z 軸 = 水平且垂直於翅膀方向：繞區域 Z 轉就是上下拍
        axis = UP_W.cross((b - a).normalized())
        e.align_roll(TO_ARM.to_3x3() @ (axis.normalized() if axis.length > 1e-3 else Vector((0, -1, 0))))
        e.parent = eb[prev]
        e.use_connect = i > 0
        # 繞區域 Z 正轉時末端往區域 -X 移動：-X（換回世界座標）朝上就是正號
        WSIGN[name] = 1 if -(arm.matrix_world.to_3x3() @ e.x_axis).z > 0 else -1
        prev = name
    WING[side] = (root, tip)
    print(f'wing {side} root', tuple(round(v, 3) for v in root), 'tip', tuple(round(v, 3) for v in tip), 'parent', PARENT)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- 權重：翅膀頂點依離翅根的距離分給兩節，其他頂點不受翅膀影響 ----
for side in wing_pts:
    for n in (f'Wing1.{side}', f'Wing2.{side}'):
        if n not in body.vertex_groups:
            body.vertex_groups.new(name=n)
if not RIGGED:
    for n in ('Hips', 'Head'):
        body.vertex_groups.new(name=n)
for i, (w, sd) in enumerate(zip(ws, SIDE)):
    if sd is None:
        if not RIGGED:
            # 頭和身體之間留一段漸變
            k = min(1.0, max(0.0, (front + hl * 1.2 - w.y) / (hl * 0.4)))
            body.vertex_groups['Head'].add([i], k, 'REPLACE')
            body.vertex_groups['Hips'].add([i], 1 - k, 'REPLACE')
        continue
    for g in list(body.vertex_groups):
        if not g.name.startswith('Wing'):
            g.remove([i])
    root, tip = WING[sd]
    k = min(1.0, (w - root).length / max(1e-6, (tip - root).length))
    k2 = min(1.0, max(0.0, (k - 0.35) / 0.3))
    body.vertex_groups[f'Wing1.{sd}'].add([i], 1 - k2, 'REPLACE')
    body.vertex_groups[f'Wing2.{sd}'].add([i], k2, 'REPLACE')
if not RIGGED:
    body.parent = arm
    m = body.modifiers.new('Armature', 'ARMATURE')
    m.object = arm

pb = arm.pose.bones
for side in wing_pts:
    for n in (f'Wing1.{side}', f'Wing2.{side}'):
        pb[n].rotation_mode = 'XYZ'


def wings(a1, a2):
    # 正值 = 往上
    for side in wing_pts:
        pb[f'Wing1.{side}'].rotation_euler.z = WSIGN[f'Wing1.{side}'] * a1
        pb[f'Wing2.{side}'].rotation_euler.z = WSIGN[f'Wing2.{side}'] * a2


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def flap(t, cycles, amp=1.0):
    ph = TAU * cycles * t
    return amp * (FLAP * math.sin(ph) - 0.2), amp * (FLAP * 0.7 * math.sin(ph - 0.8) - 0.08)


def beat(t):
    # 出招：翅膀高舉 → 用力下拍
    wind = ease(t / 0.35) * (1 - ease((t - 0.35) / 0.15))
    strike = ease((t - 0.35) / 0.2) * (1 - ease((t - 0.7) / 0.3))
    return 0.9 * wind - 0.5 * strike, 0.6 * wind - 0.3 * strike, wind, strike


def wing_keys(kind, t, dur):
    if kind == 'walk':
        return flap(t, max(1, round(dur * 1.6)))
    if kind == 'idle':
        return flap(t, max(1, round(dur * 1.0)), 0.6)
    if kind == 'attack':
        return beat(t)[:2]
    if kind == 'hit':
        k = math.sin(math.pi * min(1.0, t / 0.9))
        return 0.6 * k, 0.4 * k
    # 倒地：翅膀往上收起再垂下
    fall, settle = ease(t / 0.55), ease((t - 0.5) / 0.5)
    return 1.0 * fall - 0.6 * settle, 0.8 * fall - 0.5 * settle


def kind_of(name):
    n = name.lower()
    for k, words in (('death', ('death', 'dying', 'fall', 'knock')), ('hit', ('hit', 'reaction')), ('walk', ('walk', 'run', 'fly')), ('idle', ('idle',))):
        if any(wd in n for wd in words):
            return k
    return 'attack'


arm.animation_data_create()
if RIGGED:
    # 飛行用的動作：Meshy 沒有飛行動作，複製一段（例如待機）改成快速拍翅，給遊戲的 walk 用
    if cfg.get('flyFrom') in bpy.data.actions:
        bpy.data.actions[cfg['flyFrom']].copy().name = 'Fly'

    def fcurves_of(act):
        # Blender 4.4 起動作改成分層（layers → strips → channelbags）
        if getattr(act, 'fcurves', None) is not None:
            return list(act.fcurves)
        return [fc for layer in act.layers for strip in layer.strips for cb in strip.channelbags for fc in cb.fcurves]

    # holdBody：這些動作的身體停在第一格（Meshy 的待機會轉身，懸停時看起來像在亂轉），只留翅膀在動
    for name in cfg.get('holdBody', []):
        act = bpy.data.actions.get(name)
        if not act:
            continue
        for fc in fcurves_of(act):
            if '"Wing' in fc.data_path or len(fc.keyframe_points) < 2:
                continue
            v = fc.keyframe_points[0].co[1]
            for kp in fc.keyframe_points:
                kp.co[1] = v
                kp.handle_left[1] = v
                kp.handle_right[1] = v
    # 原本的每段動作疊上拍翅（只加翅膀骨頭的關鍵影格）
    for act in list(bpy.data.actions):
        arm.animation_data.action = act
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        kind = kind_of(act.name)
        dur = (f1 - f0) / FPS
        for f in range(f0, f1 + 1):
            t = (f - f0) / max(1, f1 - f0)
            wings(*wing_keys(kind, t, dur))
            for side in wing_pts:
                for n in (f'Wing1.{side}', f'Wing2.{side}'):
                    pb[n].keyframe_insert('rotation_euler', frame=f)
        print('wings on', act.name, kind, f1 - f0, 'frames')
    arm.animation_data.action = None
    arm.data.pose_position = 'POSE'
else:
    for p in pb:
        p.rotation_mode = 'XYZ'
    drop = centroid(body_pts).z - zmn

    def pose(kind, t, dur):
        for p in pb:
            p.rotation_euler = (0, 0, 0)
            p.location = (0, 0, 0)
        hips, head = pb['Hips'], pb['Head']
        if kind in ('walk', 'idle'):
            cyc = max(1, round(dur * (1.6 if kind == 'walk' else 1.0)))
            ph = TAU * cyc * t
            wings(*flap(t, cyc, 1.0 if kind == 'walk' else 0.6))
            # 下拍時身體被抬起來（Hips 的區域 Z 朝上）
            hips.location = (0, 0, -0.04 * H * math.cos(ph))
            hips.rotation_euler.x = 0.05 * math.sin(ph)
            head.rotation_euler.x = 0.06 * math.sin(ph + 1)
        elif kind == 'attack':
            a1, a2, wind, strike = beat(t)
            wings(a1, a2)
            # 往下俯衝咬：身體低頭、頭往前伸
            hips.rotation_euler.x = 0.15 * wind - 0.35 * strike
            hips.location = (0, 0, (0.05 * wind - 0.06 * strike) * H)
            head.rotation_euler.x = 0.2 * wind - 0.4 * strike
        elif kind == 'hit':
            k = math.sin(math.pi * min(1.0, t / 0.9))
            wings(0.6 * k, 0.4 * k)
            hips.rotation_euler.x = 0.25 * k
            head.rotation_euler.x = 0.3 * k
        else:
            # 翅膀收到背上、往前栽下去（翻滾的話翅膀會插進地面）
            fall, settle = ease(t / 0.55), ease((t - 0.5) / 0.5)
            wings(1.1 * fall - 0.3 * settle, 0.9 * fall - 0.2 * settle)
            hips.rotation_euler.x = -0.7 * fall
            hips.rotation_euler.y = 0.3 * settle
            hips.location = (0, 0, -drop * 0.5 * fall)
            head.rotation_euler.x = 0.3 * settle

    for name, dur, kind in (('idle', 2.0, 'idle'), ('walk', 1.0, 'walk'), ('attack', 0.8, 'attack'), ('hit', 0.4, 'hit'), ('death', 1.2, 'death')):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        n = round(dur * FPS)
        for f in range(n + 1):
            pose(kind, f / n, dur)
            for p in pb:
                p.keyframe_insert('rotation_euler', frame=f + 1)
                if p.name == 'Hips':
                    p.keyframe_insert('location', frame=f + 1)
    arm.animation_data.action = None
    for p in pb:
        p.rotation_euler = (0, 0, 0)
        p.location = (0, 0, 0)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='ACTIONS',
    export_force_sampling=True,
    export_skins=True,
    export_yup=True,
)
print('saved', out, [a.name for a in bpy.data.actions])
