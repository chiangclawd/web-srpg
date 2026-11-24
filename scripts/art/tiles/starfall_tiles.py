# 《星墜殘響》的地塊：用 Blender（Cycles）把每種地形渲染成等角的柱狀圖，取代遊戲裡用 Canvas 畫的版本。
#
#   blender -b --factory-startup -P scripts/art/tiles/starfall_tiles.py -- <輸出資料夾> [--theme=bay] [地形 ...]
#   py scripts/art/tiles/pack_tiles.py <輸出資料夾> public/assets/starfall/tiles.webp
#
# 主題（--theme）：base 是冰原和船艙共用的那一套（tiles.webp）；bay 冷凍艙、reactor 反應爐、field 戰場各自一套
# （tiles_bay.webp …），只收那個主題的關卡用得到的地形。每個主題渲染到自己的資料夾，再各打包一次。
#
# 每張 192×480（遊戲裡縮成 96×240）：菱形頂面的中心在 (96, 168)，側面往下延伸、由 pack_tiles.py 淡出。
# 投影跟單位圖表一樣：正交鏡頭、俯角 30°、yaw 45°，所以一格的菱形是 2:1；一層高度 = 畫面上 48 px。
# 光從畫面左上來（朝左下的面受光、朝右下的面背光），跟遊戲裡的陰影方向一致。
import bpy, sys, math, random, os, zlib
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
THEME = 'base'
ONLY = set()
for a in args[1:]:
    if a.startswith('--theme='):
        THEME = a.split('=', 1)[1]
    else:
        ONLY.add(a)
os.makedirs(OUT, exist_ok=True)

W, H = 192, 480
PX = W / math.sqrt(2)             # 一個世界單位在畫面上的寬度（像素）
LEVEL = 48 / (PX * math.cos(math.radians(30)))   # 一層高度（世界單位）
DEPTH = 264 / (PX * math.cos(math.radians(30)))  # 側面往下畫多長
# 每個主題有哪些地形、各幾個花樣（花樣數要跟 view/textures.ts 的 variantsOf 一樣）
THEMES = {
    'base': {'ice': 8, 'snow': 3, 'deck': 3, 'grate': 3, 'rubble': 3, 'barricade': 3, 'wall': 3, 'machine': 3},
    'bay': {'deck': 3, 'grate': 3, 'rubble': 3, 'barricade': 3, 'wall': 3},
    'reactor': {'deck': 3, 'grate': 3, 'rubble': 3, 'barricade': 3, 'wall': 3, 'machine': 3},
    'field': {'ice': 8, 'snow': 3, 'deck': 3, 'grate': 3, 'rubble': 3, 'rubbleice': 3, 'barricade': 3, 'wall': 3},
}
VARIANTS = THEMES[THEME]
# 太陽的強度與顏色、環境光的顏色與強度。方向都一樣（遊戲裡的影子是固定的）
LIGHT = {
    'base': (4.6, 0xffffff, 0x9fc4e8, 0.6),
    'bay': (3.9, 0xdcf2ff, 0x7fb4c8, 0.55),       # 冷凍艙：偏青的冷光
    'reactor': (4.0, 0xfff1e2, 0x9a9aa2, 0.55),   # 反應爐：暖色的主光
    'field': (3.5, 0xdde8ff, 0x93a8c4, 0.6),      # 夜裡的冰原：主光弱一點
}
# 甲板類的色票：兩種鋼板、船殼側面、深色零件、亮色零件、發光的顏色（底色、發光色、強度）
PAL = {
    'bay': dict(plate=(0x4f6478, 0x587086), hull=0x34465a, dark=0x1f2c3c, steel=0x6f8296, glow=(0x58f0d2, 0x7df7e0, 6.0), rough=0.5, metal=0.6),
    # 反應爐的鋼板是暖灰色：太黑的話深色的敵機站在上面看不清楚
    'reactor': dict(plate=(0x6e6b69, 0x787573), hull=0x423e3c, dark=0x211f1e, steel=0x8c8884, glow=(0xff8a2a, 0xff7412, 4.2), rough=0.5, metal=0.45),
    'field': dict(plate=(0x5a6258, 0x636c60), hull=0x3c443e, dark=0x23282a, steel=0x7a8078, glow=(0xffe6a8, 0xfff0c4, 5.5), rough=0.6, metal=0.4),
}


def rgb(hex_, a=1.0):
    c = [((hex_ >> s) & 255) / 255 for s in (16, 8, 0)]
    return [x ** 2.2 for x in c] + [a]   # sRGB → linear


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            for d in prefs.devices:
                d.use = d.type == kind
            if any(d.use for d in prefs.devices):
                sc.cycles.device = 'GPU'
                break
        except Exception:
            pass
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'   # 不要 Filmic / AgX：顏色要跟指定的色票一樣
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    # 鏡頭：正交，俯角 30°，從 (+x, +y) 往原點看 → 世界 +y 在畫面右下（遊戲的 u）、+x 在畫面左下（遊戲的 v）
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = H / PX
    cam = bpy.data.objects.new('cam', cam_data)
    sc.collection.objects.link(cam)
    el = math.radians(30)
    d = 20
    k = math.cos(el) * d / math.sqrt(2)
    cam.location = (k, k, math.sin(el) * d)
    cam.rotation_euler = (math.radians(60), 0, math.radians(135))
    # 頂面中心（世界原點）要落在畫面 y = 168，比正中央（240）高 72 px
    cam_data.shift_y = -72 / H
    sc.camera = cam
    # 光：一盞從畫面左上來的太陽，加上環境光（強度和顏色跟著主題換）
    energy, sun_color, sky, sky_k = LIGHT[THEME]
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = energy
    sun.data.color = rgb(sun_color)[:3]
    sun.data.angle = math.radians(8)
    # 光線的方向：主要打在朝左下的面（法線 +x），朝右下的面（法線 +y）只擦到一點
    sun.rotation_euler = Vector((-0.78, -0.12, -0.62)).to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(sun)
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = rgb(sky)
    bg.inputs[1].default_value = sky_k
    sc.world = world
    return sc


def mat(name, color, rough=0.6, metal=0.0, emit=None, emit_k=0.0, bump=None, trans=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = rgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if trans:
        b.inputs['Transmission Weight'].default_value = trans
    if emit is not None:
        b.inputs['Emission Color'].default_value = rgb(emit)
        b.inputs['Emission Strength'].default_value = emit_k
    if bump:
        scale, strength, detail = bump
        tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = scale
        tex.inputs['Detail'].default_value = detail
        bp = nt.nodes.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = strength
        nt.links.new(tex.outputs['Fac'], bp.inputs['Height'])
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
        # 顏色也跟著雜訊深淺一點點，才不會像塑膠
        mix = nt.nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Fac'].default_value = 0.35
        mix.inputs['Color1'].default_value = rgb(color)
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = 0.3
        ramp.color_ramp.elements[0].color = (0.62, 0.62, 0.62, 1)
        ramp.color_ramp.elements[1].position = 0.75
        nt.links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], mix.inputs['Color2'])
        nt.links.new(mix.outputs['Color'], b.inputs['Base Color'])
    return m


def box(u0, v0, u1, v1, z0, z1, material, bevel=0.012, rot=0.0):
    """遊戲的格子座標 (u, v ∈ 0..1；u 往畫面右下、v 往左下) 的方塊。格子中心在世界原點，頂面 z = 0。世界 x = v、y = u"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=((v0 + v1) / 2 - 0.5, (u0 + u1) / 2 - 0.5, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.scale = (v1 - v0, u1 - u0, z1 - z0)
    o.rotation_euler[2] = rot
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    o.data.materials.append(material)
    return o


def cyl(u, v, r, z0, z1, material, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(v - 0.5, u - 0.5, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.data.materials.append(material)
    return o


def rod(u0, v0, u1, v1, z, r, material, verts=20):
    """橫躺的圓柱：從 (u0, v0) 到 (u1, v1)，中心軸在高度 z"""
    x0, y0, x1, y1 = v0 - 0.5, u0 - 0.5, v1 - 0.5, u1 - 0.5
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=r, depth=math.hypot(x1 - x0, y1 - y0), location=((x0 + x1) / 2, (y0 + y1) / 2, z),
        rotation=(0, math.pi / 2, math.atan2(y1 - y0, x1 - x0)))
    o = bpy.context.active_object
    o.data.materials.append(material)
    return o


def blob(u, v, r, z, material, squash=0.3, wobble=0.0, seed=0.0):
    """壓扁的球：雪堆、霜、焦痕、熔渣。wobble > 0 時用雜訊把輪廓推得不規則（不然看起來像一枚一枚的硬幣）"""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(v - 0.5, u - 0.5, z), segments=32, ring_count=16)
    o = bpy.context.active_object
    o.scale[2] = squash
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    if wobble:
        tex = bpy.data.textures.new('w', 'CLOUDS')
        tex.noise_scale = r * 0.9
        e = bpy.data.objects.new('e', None)
        e.location = (seed * 2.3 + u, seed * 1.3 + v, seed)
        bpy.context.scene.collection.objects.link(e)
        d = o.modifiers.new('wobble', 'DISPLACE')
        d.texture = tex
        d.strength = r * wobble
        d.mid_level = 0.5
        d.texture_coords = 'OBJECT'
        d.texture_coords_object = e
    return o


def lumpy(o, strength, scale, seed, sub=4):
    """把頂面弄得凹凸不平（雪、冰）：細分之後用雜訊位移"""
    s = o.modifiers.new('sub', 'SUBSURF')
    s.subdivision_type = 'SIMPLE'
    s.levels = s.render_levels = sub
    tex = bpy.data.textures.new('n', 'CLOUDS')
    tex.noise_scale = scale
    d = o.modifiers.new('disp', 'DISPLACE')
    d.texture = tex
    d.strength = strength
    d.mid_level = 0.5
    d.texture_coords = 'GLOBAL'
    o.location.x += 0   # 位移用世界座標，seed 靠移動貼圖原點
    e = bpy.data.objects.new('e', None)
    e.location = (seed * 3.1, seed * 1.7, 0)
    bpy.context.scene.collection.objects.link(e)
    d.texture_coords = 'OBJECT'
    d.texture_coords_object = e
    return o


def build_base(kind, v):
    """冰原和船艙共用的那一套"""
    r = random.Random(hash((kind, v)) & 0xffff)
    steel = mat('steel', 0x6a7d96, rough=0.55, metal=0.55, bump=(38, 0.12, 6))
    dark = mat('dark', 0x2a3446, rough=0.6, metal=0.4, bump=(30, 0.1, 4))
    hull = mat('hull', 0x46566e, rough=0.6, metal=0.5, bump=(22, 0.14, 5))
    glow = mat('glow', 0x3fd6ff, emit=0x5fe3ff, emit_k=7.0)
    if kind in ('ice', 'snow'):
        ice = mat('ice', 0xa9d6ec, rough=0.16, bump=(9, 0.22, 8), trans=0.25)
        body = box(0, 0, 1, 1, -DEPTH, 0, ice, bevel=0.02)
        if kind == 'snow':
            snow = mat('snow', 0xf4f9fd, rough=0.9, bump=(60, 0.08, 3))
            cap = box(-0.02, -0.02, 1.02, 1.02, -0.05, 0.035, snow, bevel=0.03)
            lumpy(cap, 0.09, 0.22, v + 1)
            for _ in range(4):
                x, y, s = r.uniform(0.2, 0.8), r.uniform(0.2, 0.8), r.uniform(0.1, 0.17)
                bpy.ops.mesh.primitive_uv_sphere_add(radius=s, location=(y - 0.5, x - 0.5, 0.01), segments=20, ring_count=10)
                m = bpy.context.active_object
                m.scale[2] = 0.34
                m.data.materials.append(snow)
        else:
            lumpy(body, 0.016, 0.5, v + 1, sub=5)
            frost = mat('frost', 0xeaf6fd, rough=0.75)
            # 大部分的冰面是平的；只有兩種花樣有一道細裂縫。每格都有花樣的話整片看起來像貼磁磚
            if v in (3, 4):
                x, y = r.uniform(0.3, 0.7), r.uniform(0.3, 0.7)
                box(x - 0.26, y - 0.005, x + 0.26, y + 0.005, -0.02, 0.004, frost, bevel=0.002, rot=r.uniform(0, math.pi))
        return
    if kind == 'wall':
        z = LEVEL * 2
        box(0, 0, 1, 1, -DEPTH, z, hull, bevel=0.02)
        box(0.06, 0.99, 0.94, 1.012, z - 0.2, z - 0.15, glow, bevel=0)          # 朝左下那面（v = 1）的燈條
        box(0.04, 0.04, 0.96, 0.96, z, z + 0.03, dark, bevel=0.01)
        hazard = mat('hazard', 0xf0be3c, rough=0.5)
        for i in range(5):
            box(0.99, 0.08 + i * 0.18, 1.01, 0.16 + i * 0.18, z - 0.42, z - 0.3, hazard, bevel=0)   # 朝右下那面（u = 1）的警示塊
        return
    # 甲板類：鋼板拼成的頂面 + 船殼側面
    box(0, 0, 1, 1, -DEPTH, -0.02, hull, bevel=0.015)
    gap = 0.012
    for i in range(2):
        for j in range(2):
            k = 0x6a7d96 if (i + j + v) % 2 else 0x73869f
            plate = mat('plate', k, rough=0.5, metal=0.6, bump=(40, 0.1, 6))
            box(i * 0.5 + gap, j * 0.5 + gap, i * 0.5 + 0.5 - gap, j * 0.5 + 0.5 - gap, -0.03, 0, plate, bevel=0.008)
    for x, y in ((0.08, 0.08), (0.92, 0.08), (0.92, 0.92), (0.08, 0.92)):
        cyl(x, y, 0.016, -0.005, 0.006, dark, verts=10)
    for dz in (0.34, 0.8, 1.3):                                                   # 側面的橫向補強條
        box(-0.012, -0.012, 1.012, 1.012, -dz - 0.03, -dz, dark, bevel=0.006)
    if kind == 'deck':
        if v == 1:                                                                # 通風口
            box(0.58, 0.14, 0.88, 0.44, -0.01, 0.004, dark, bevel=0.004)
            for i in range(4):
                box(0.61 + i * 0.065, 0.17, 0.635 + i * 0.065, 0.41, 0.0, 0.012, steel, bevel=0.002)
        if v == 2:                                                                # 角落的警示條
            hazard = mat('hazard', 0xf0be3c, rough=0.5)
            for i in range(4):
                box(0.56 + i * 0.1, 0.9, 0.61 + i * 0.1, 0.985, -0.002, 0.004, hazard if i % 2 == 0 else dark, bevel=0)
    elif kind == 'grate':
        box(0.44, -0.005, 0.56, 1.005, -0.04, 0.002, dark, bevel=0.004)
        box(0.47, 0.0, 0.53, 1.0, -0.02, 0.006, glow, bevel=0)
        box(0.2, 0.47, 0.8, 0.53, -0.02, 0.005, glow, bevel=0)
        box(0.14, 0.99, 0.86, 1.014, -0.2, -0.16, glow, bevel=0)                   # 朝左下那面的管線
    elif kind == 'machine':
        cyl(0.5, 0.5, 0.4, -0.005, 0.02, dark, verts=40)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.4, minor_radius=0.012, location=(0, 0, 0.022))
        bpy.context.active_object.data.materials.append(glow)
    elif kind == 'rubble':
        orange = mat('orange', 0xd9772e, rough=0.55, metal=0.2, bump=(30, 0.15, 5))
        for i in range(7):
            x, y, s = r.uniform(0.2, 0.75), r.uniform(0.2, 0.75), r.uniform(0.12, 0.26)
            m = orange if i == 2 else (steel if i % 2 else dark)
            o = box(x, y, x + s, y + s * r.uniform(0.5, 1.1), 0, r.uniform(0.03, 0.12), m, bevel=0.01, rot=r.uniform(0, math.pi))
            o.rotation_euler[0] = r.uniform(-0.25, 0.25)
            o.rotation_euler[1] = r.uniform(-0.25, 0.25)
    elif kind == 'barricade':
        orange = mat('orange', 0xe07a2e, rough=0.5, metal=0.25, bump=(26, 0.12, 4))
        white = mat('white', 0xdfe6ee, rough=0.5, metal=0.2, bump=(26, 0.1, 4))
        # 遊戲裡單位站在格子前緣：貨櫃靠後（畫面上方的兩條邊）
        box(0.04, 0.04, 0.96, 0.3, 0, 0.21, orange, bevel=0.012)
        box(0.04, 0.3, 0.3, 0.96, 0, 0.21, white, bevel=0.012)
        for i in range(1, 9):
            box(0.04 + i * 0.1, 0.3, 0.06 + i * 0.1, 0.312, 0.02, 0.19, orange, bevel=0)     # 浪板
        for i in range(1, 6):
            box(0.3, 0.3 + i * 0.1, 0.312, 0.32 + i * 0.1, 0.02, 0.19, white, bevel=0)
        box(0.3, 0.06, 0.62, 0.28, 0.21, 0.33, dark, bevel=0.012)


# ───────── 各章的主題 ─────────

def deck_body(p, v):
    """甲板類共用的底：船殼側面、2×2 鋼板、四角的螺栓、側面的補強條。回傳常用的幾種材質"""
    hull = mat('hull', p['hull'], rough=0.6, metal=0.5, bump=(22, 0.14, 5))
    dark = mat('dark', p['dark'], rough=0.6, metal=0.4, bump=(30, 0.1, 4))
    steel = mat('steel', p['steel'], rough=0.55, metal=0.55, bump=(38, 0.12, 6))
    box(0, 0, 1, 1, -DEPTH, -0.02, hull, bevel=0.015)
    gap = 0.012
    for i in range(2):
        for j in range(2):
            plate = mat('plate', p['plate'][(i + j + v) % 2], rough=p['rough'], metal=p['metal'], bump=(40, 0.1, 6))
            box(i * 0.5 + gap, j * 0.5 + gap, i * 0.5 + 0.5 - gap, j * 0.5 + 0.5 - gap, -0.03, 0, plate, bevel=0.008)
    for x, y in ((0.08, 0.08), (0.92, 0.08), (0.92, 0.92), (0.08, 0.92)):
        cyl(x, y, 0.016, -0.005, 0.006, dark, verts=10)
    for dz in (0.34, 0.8, 1.3):
        box(-0.012, -0.012, 1.012, 1.012, -dz - 0.03, -dz, dark, bevel=0.006)
    return hull, dark, steel


def glow_mats(p):
    c, e, k = p['glow']
    return mat('glow', c, emit=e, emit_k=k), mat('glow_dim', c, emit=e, emit_k=k * 0.38)


def scatter(r, n, material, lo=0.05, hi=0.11, area=(0.12, 0.88, 0.12, 0.88), squash=0.07, z=0.0, wobble=1.1):
    """在一塊範圍裡撒幾片輪廓不規則的薄斑（霜、雪、焦痕）"""
    for _ in range(n):
        blob(r.uniform(area[0], area[1]), r.uniform(area[2], area[3]), r.uniform(lo, hi), z, material, squash, wobble, r.uniform(0, 50))


def debris(r, mats, n=7, zmax=0.12):
    """一堆歪七扭八的碎塊（殘骸堆共用）"""
    for i in range(n):
        x, y, s = r.uniform(0.2, 0.75), r.uniform(0.2, 0.75), r.uniform(0.12, 0.26)
        o = box(x, y, x + s, y + s * r.uniform(0.5, 1.1), 0, r.uniform(0.03, zmax), mats[i % len(mats)], bevel=0.01, rot=r.uniform(0, math.pi))
        o.rotation_euler[0] = r.uniform(-0.25, 0.25)
        o.rotation_euler[1] = r.uniform(-0.25, 0.25)


def build_bay(kind, v, r):
    """冷凍艙（第二章）：偏青的冷色鋼板、結霜、睡眠艙的青綠色燈"""
    p = PAL['bay']
    glow, glow_dim = glow_mats(p)
    frost = mat('frost', 0xc9dfea, rough=0.8, bump=(70, 0.06, 3))
    white = mat('white', 0xd3e0ea, rough=0.42, metal=0.2, bump=(26, 0.08, 4))
    if kind == 'wall':
        hull = mat('hull', p['hull'], rough=0.6, metal=0.5, bump=(22, 0.14, 5))
        dark = mat('dark', p['dark'], rough=0.6, metal=0.4, bump=(30, 0.1, 4))
        z = LEVEL * 2
        box(0, 0, 1, 1, -DEPTH, z, hull, bevel=0.02)
        box(0.04, 0.04, 0.96, 0.96, z, z + 0.03, dark, bevel=0.01)
        # 朝左下那面（v = 1）：一扇睡眠艙的觀察窗，透出青綠色的光
        box(0.27, 0.985, 0.73, 1.012, z - 0.68, z - 0.12, dark, bevel=0.004)
        box(0.32, 0.995, 0.68, 1.02, z - 0.63, z - 0.17, glow_dim, bevel=0)
        box(0.485, 0.995, 0.515, 1.026, z - 0.63, z - 0.17, dark, bevel=0)
        # 朝右下那面（u = 1）：一條橫的燈
        box(0.99, 0.1, 1.012, 0.9, z - 0.2, z - 0.16, glow, bevel=0)
        cap = box(0.02, 0.02, 0.98, 0.98, z + 0.022, z + 0.036, frost, bevel=0.012)   # 頂上薄薄一層霜
        lumpy(cap, 0.02, 0.2, v + 4)
        return
    hull, dark, steel = deck_body(p, v)
    if kind == 'deck':
        # 三種花樣只有一種有東西可看：每格都有裝飾的話，整片地板會像花布
        if v == 1:                                                                # 嵌在地板裡的一小段導引燈
            box(0.16, 0.7, 0.44, 0.76, -0.012, 0.003, dark, bevel=0.003)
            box(0.18, 0.715, 0.42, 0.745, -0.008, 0.005, glow_dim, bevel=0)
        if v == 2:                                                                # 角落結了一片霜
            scatter(r, 6, frost, 0.05, 0.1, (0.1, 0.46, 0.52, 0.9), squash=0.06)
    elif kind == 'grate':
        box(0.39, -0.005, 0.61, 1.005, -0.06, 0.0015, dark, bevel=0.004)          # 冷卻液的溝
        box(0.42, 0.0, 0.58, 1.0, -0.02, 0.004, glow_dim, bevel=0)                # 光要高過溝的頂面才看得到；太亮會整條變白
        for i in range(7):
            box(0.39, 0.055 + i * 0.14, 0.61, 0.085 + i * 0.14, 0.0, 0.012, steel, bevel=0.002)   # 橫的格柵條
        box(0.14, 0.99, 0.86, 1.014, -0.2, -0.16, glow, bevel=0)                   # 朝左下那面的管線
        scatter(r, 3, frost, 0.04, 0.08, (0.66, 0.92, 0.1, 0.9), squash=0.06)
    elif kind == 'rubble':
        debris(r, [white, dark, steel, white, dark, glow_dim, steel])              # 摔碎的睡眠艙：白色外殼、還亮著的玻璃
        scatter(r, 4, frost, 0.05, 0.09, squash=0.08)
    elif kind == 'barricade':
        # 冷凍罐靠後（畫面上方的兩條邊）：一個橫躺的、兩個立著的
        for u in (0.2, 0.8):
            box(u - 0.05, 0.07, u + 0.05, 0.27, 0, 0.06, dark, bevel=0.008)        # 托架
        rod(0.08, 0.17, 0.92, 0.17, 0.15, 0.105, white, verts=28)
        rod(0.34, 0.17, 0.66, 0.17, 0.15, 0.11, glow_dim, verts=28)                # 觀察窗那一圈
        for u in (0.085, 0.915):
            rod(u - 0.02, 0.17, u + 0.02, 0.17, 0.15, 0.112, dark, verts=28)
        for vv, h in ((0.5, 0.27), (0.78, 0.2)):
            cyl(0.17, vv, 0.105, 0, h, white, verts=28)
            cyl(0.17, vv, 0.11, h - 0.08, h - 0.05, glow_dim, verts=28)
            cyl(0.17, vv, 0.085, h, h + 0.025, dark, verts=28)
        scatter(r, 3, frost, 0.05, 0.08, (0.4, 0.9, 0.4, 0.9), squash=0.06)


def build_reactor(kind, v, r):
    """反應爐（第三章）：深色的槍鐵、黑黃警示條、底下透出來的橘光"""
    p = PAL['reactor']
    glow, glow_dim = glow_mats(p)
    hazard = mat('hazard', 0xf0be3c, rough=0.5)
    black = mat('black', 0x15171c, rough=0.6)
    if kind == 'wall':
        hull = mat('hull', 0x4a4643, rough=0.55, metal=0.5, bump=(22, 0.14, 5))
        dark = mat('dark', p['dark'], rough=0.6, metal=0.4, bump=(30, 0.1, 4))
        z = LEVEL * 2
        box(0, 0, 1, 1, -DEPTH, z, hull, bevel=0.02)
        box(0.04, 0.04, 0.96, 0.96, z, z + 0.03, dark, bevel=0.01)
        box(0.06, 0.99, 0.94, 1.012, z - 0.2, z - 0.15, glow, bevel=0)            # 朝左下那面（v = 1）的燈條
        for i in range(3):                                                        # 同一面的散熱鰭片
            box(0.14, 0.985, 0.86, 1.012, z - 0.42 - i * 0.12, z - 0.37 - i * 0.12, dark, bevel=0.003)
        for i in range(8):                                                        # 朝右下那面（u = 1）的黑黃警示帶
            box(0.99, 0.04 + i * 0.115, 1.01, 0.155 + i * 0.115, z - 0.36, z - 0.24, hazard if i % 2 == 0 else black, bevel=0)
        box(0.3, 0.3, 0.7, 0.7, z + 0.03, z + 0.05, mat('vent', p['glow'][0], emit=p['glow'][1], emit_k=1.0), bevel=0.004)   # 頂上的排熱口
        for i in range(4):
            box(0.3, 0.32 + i * 0.1, 0.7, 0.37 + i * 0.1, z + 0.045, z + 0.065, dark, bevel=0.002)
        return
    hull, dark, steel = deck_body(p, v)
    if kind == 'deck':
        if v == 1:                                                                # 排熱口：格柵底下是橘光
            box(0.56, 0.14, 0.9, 0.46, -0.03, 0.0015, dark, bevel=0.004)
            box(0.58, 0.16, 0.88, 0.44, -0.02, 0.004, glow_dim, bevel=0)
            for i in range(5):
                box(0.585 + i * 0.062, 0.15, 0.61 + i * 0.062, 0.45, 0.0, 0.012, steel, bevel=0.002)
        if v == 2:                                                                # 一塊檢修蓋（跟鋼板差不多顏色，不搶眼）
            box(0.14, 0.58, 0.42, 0.86, -0.004, 0.005, steel, bevel=0.006)
            box(0.25, 0.7, 0.31, 0.74, 0.005, 0.012, dark, bevel=0.003)
    elif kind == 'grate':
        box(0.36, -0.005, 0.64, 1.005, -0.07, 0.0015, dark, bevel=0.004)          # 整條寬的導熱溝
        box(0.39, 0.0, 0.61, 1.0, -0.02, 0.004, glow_dim, bevel=0)
        for i in range(9):
            box(0.36, 0.04 + i * 0.11, 0.64, 0.066 + i * 0.11, 0.0, 0.012, steel, bevel=0.002)
        box(0.14, 0.99, 0.86, 1.014, -0.2, -0.16, glow, bevel=0)
    elif kind == 'machine':
        cyl(0.5, 0.5, 0.4, -0.005, 0.02, dark, verts=40)
        cyl(0.5, 0.5, 0.2, 0.02, 0.03, mat('core', p['glow'][0], emit=p['glow'][1], emit_k=1.0), verts=32)
        for i in range(8):                                                        # 渦輪的葉片
            a = i * math.pi / 4
            rod(0.5 + math.cos(a) * 0.1, 0.5 + math.sin(a) * 0.1, 0.5 + math.cos(a) * 0.36, 0.5 + math.sin(a) * 0.36, 0.03, 0.014, steel, verts=8)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.4, minor_radius=0.014, location=(0, 0, 0.022))
        bpy.context.active_object.data.materials.append(glow)
    elif kind == 'rubble':
        slag = mat('slag', 0xff7a2a, emit=0xff8a30, emit_k=2.6)
        rust = mat('rust', 0x8c4630, rough=0.7, metal=0.3, bump=(30, 0.18, 5))
        debris(r, [dark, steel, rust, dark, steel, dark, steel])
        for _ in range(3):                                                        # 還在發紅的熔渣
            blob(r.uniform(0.25, 0.75), r.uniform(0.25, 0.75), r.uniform(0.035, 0.06), 0.012, slag, 0.5)
    elif kind == 'barricade':
        red = mat('red', 0x9c3c2c, rough=0.5, metal=0.3, bump=(26, 0.12, 4))
        # 靠後的兩條邊：一道遮蔽板、兩支立著的冷卻劑鋼瓶
        box(0.04, 0.05, 0.96, 0.16, 0, 0.24, steel, bevel=0.012)
        for i in range(7):
            box(0.08 + i * 0.125, 0.155, 0.205 + i * 0.125, 0.166, 0.13, 0.2, hazard if i % 2 == 0 else black, bevel=0)
        box(0.1, 0.16, 0.9, 0.24, 0, 0.05, dark, bevel=0.006)                      # 板子的底座
        for vv, h in ((0.5, 0.3), (0.78, 0.3)):
            cyl(0.17, vv, 0.1, 0, h, red, verts=28)
            cyl(0.17, vv, 0.104, h * 0.55, h * 0.55 + 0.03, glow_dim, verts=28)
            cyl(0.17, vv, 0.05, h, h + 0.04, dark, verts=16)
        box(0.07, 0.36, 0.27, 0.92, 0, 0.04, dark, bevel=0.006)                    # 鋼瓶的底座


def build_field(kind, v, r):
    """戰場（第四章）：夜裡的冰原，冰比較暗、有焦痕和履帶印；工事是水泥和軍綠色的鋪板，上面積雪"""
    p = PAL['field']
    glow, glow_dim = glow_mats(p)
    snow = mat('snow', 0xe6eff7, rough=0.9, bump=(60, 0.08, 3))
    conc = mat('conc', 0x8a9098, rough=0.92, bump=(18, 0.3, 6))
    if kind in ('ice', 'snow'):
        ice = mat('ice', 0x93aabc, rough=0.24, bump=(9, 0.24, 8), trans=0.14)
        body = box(0, 0, 1, 1, -DEPTH, 0, ice, bevel=0.02)
        if kind == 'snow':
            cap = box(-0.02, -0.02, 1.02, 1.02, -0.05, 0.035, snow, bevel=0.03)
            lumpy(cap, 0.09, 0.22, v + 7)
            scatter(r, 4, snow, 0.1, 0.17, (0.2, 0.8, 0.2, 0.8), squash=0.34, z=0.01)
            grit = mat('grit', 0x3a4250, rough=0.8)
            for _ in range(3):                                                    # 雪裡露出來的碎片
                x, y = r.uniform(0.2, 0.8), r.uniform(0.2, 0.8)
                box(x, y, x + 0.05, y + 0.03, 0.03, 0.06, grit, bevel=0.004, rot=r.uniform(0, math.pi))
            return
        lumpy(body, 0.018, 0.5, v + 11, sub=5)
        frost = mat('frost', 0xdcecf8, rough=0.75)
        if v in (3, 4):                                                           # 一道細裂縫
            x, y = r.uniform(0.3, 0.7), r.uniform(0.3, 0.7)
            box(x - 0.26, y - 0.005, x + 0.26, y + 0.005, -0.02, 0.004, frost, bevel=0.002, rot=r.uniform(0, math.pi))
        if v == 5:                                                                # 角落的一小堆雪
            scatter(r, 3, snow, 0.07, 0.12, (0.12, 0.4, 0.55, 0.88), squash=0.3, z=0.004)
        if v == 7:                                                                # 另一個角落的雪
            scatter(r, 2, snow, 0.06, 0.1, (0.58, 0.88, 0.14, 0.4), squash=0.3, z=0.004)
        # 焦痕不畫在地塊上：同一張圖會重複幾十次。遊戲裡另外撒幾處（fx.ts）
        return
    if kind == 'rubbleice':                                                       # 冰面上的殘骸：半埋在雪裡
        ice = mat('ice', 0x93aabc, rough=0.24, bump=(9, 0.24, 8), trans=0.14)
        body = box(0, 0, 1, 1, -DEPTH, 0, ice, bevel=0.02)
        lumpy(body, 0.018, 0.5, v + 21, sub=5)
        dark = mat('dark', p['dark'], rough=0.6, metal=0.4, bump=(30, 0.1, 4))
        steel = mat('steel', p['steel'], rough=0.55, metal=0.55, bump=(38, 0.12, 6))
        rust = mat('rust', 0x7c4838, rough=0.75, metal=0.3, bump=(30, 0.18, 5))
        scatter(r, 4, snow, 0.14, 0.22, (0.3, 0.7, 0.3, 0.7), squash=0.16, z=0.0, wobble=0.9)
        debris(r, [dark, steel, rust, dark, steel, dark, steel])
        scatter(r, 4, snow, 0.07, 0.12, (0.2, 0.8, 0.2, 0.8), squash=0.32, z=0.012)
        return
    if kind == 'wall':
        dark = mat('dark', p['dark'], rough=0.6, metal=0.4, bump=(30, 0.1, 4))
        hazard = mat('hazard', 0xf0be3c, rough=0.5)
        z = LEVEL * 2
        box(0, 0, 1, 1, -DEPTH, z, conc, bevel=0.025)
        for dz in (0.3, 0.62):                                                    # 模板的接縫
            box(-0.006, -0.006, 1.006, 1.006, z - dz - 0.015, z - dz, dark, bevel=0.003)
        box(0.1, 0.99, 0.9, 1.014, z - 0.2, z - 0.15, glow, bevel=0)              # 朝左下那面（v = 1）的探照燈條
        for i in range(5):
            box(0.99, 0.08 + i * 0.18, 1.01, 0.16 + i * 0.18, z - 0.5, z - 0.38, hazard, bevel=0)   # 朝右下那面（u = 1）的警示塊
        cap = box(-0.01, -0.01, 1.01, 1.01, z - 0.01, z + 0.045, snow, bevel=0.03)   # 頂上的積雪
        lumpy(cap, 0.06, 0.22, v + 3)
        return
    hull, dark, steel = deck_body(p, v)
    if kind == 'deck':
        if v == 1:                                                                # 一小段黃色的定位角標
            yellow = mat('yellow', 0xb99a3a, rough=0.7)
            box(0.7, 0.87, 0.9, 0.9, -0.002, 0.004, yellow, bevel=0)
            box(0.87, 0.7, 0.9, 0.9, -0.002, 0.004, yellow, bevel=0)
        if v == 2:                                                                # 風把雪吹到鋪板的角落
            scatter(r, 6, snow, 0.05, 0.11, (0.08, 0.42, 0.56, 0.92), squash=0.12)
    elif kind == 'grate':
        box(0.42, -0.005, 0.58, 1.005, -0.05, 0.0015, dark, bevel=0.004)          # 電纜溝
        box(0.45, 0.0, 0.55, 1.0, -0.02, 0.004, mat('lamp', 0xffd27a, emit=0xffc860, emit_k=1.1), bevel=0)
        for i in range(5):
            box(0.42, 0.06 + i * 0.2, 0.58, 0.14 + i * 0.2, 0.0, 0.012, steel, bevel=0.002)
        box(0.14, 0.99, 0.86, 1.014, -0.2, -0.16, glow, bevel=0)
        scatter(r, 3, snow, 0.05, 0.09, (0.66, 0.92, 0.1, 0.9), squash=0.12)
    elif kind == 'rubble':
        rust = mat('rust', 0x7c4838, rough=0.75, metal=0.3, bump=(30, 0.18, 5))
        debris(r, [dark, steel, rust, dark, steel, dark, steel])                   # 半埋在雪裡的殘骸
        scatter(r, 5, snow, 0.07, 0.13, (0.2, 0.8, 0.2, 0.8), squash=0.3, z=0.01)
    elif kind == 'barricade':
        olive = mat('olive', 0x5d6a4c, rough=0.7, metal=0.1, bump=(26, 0.12, 4))
        # 靠後的兩條邊各一道水泥護欄（底寬上窄），上面積雪；轉角放一個彈藥箱
        for a in (0, 1):
            wide = (0.04, 0.05, 0.96, 0.29) if a == 0 else (0.05, 0.33, 0.29, 0.96)
            slim = (0.05, 0.11, 0.95, 0.23) if a == 0 else (0.11, 0.34, 0.23, 0.95)
            box(*wide, 0, 0.09, conc, bevel=0.015)
            box(*slim, 0.08, 0.235, conc, bevel=0.014)
            cap = box(slim[0], slim[1], slim[2], slim[3], 0.225, 0.262, snow, bevel=0.012)
            lumpy(cap, 0.03, 0.2, v + a + 2, sub=3)
        box(0.36, 0.36, 0.64, 0.6, 0, 0.15, olive, bevel=0.01)
        box(0.36, 0.465, 0.64, 0.495, 0.0, 0.156, dark, bevel=0.002)


BUILD = {'bay': build_bay, 'reactor': build_reactor, 'field': build_field}

sc = None
for kind, n in VARIANTS.items():
    if ONLY and kind not in ONLY:
        continue
    for v in range(n):
        sc = reset()
        if THEME == 'base':
            build_base(kind, v)
        else:
            # 亂數的種子固定：同一張圖每次渲染出來都一樣
            BUILD[THEME](kind, v, random.Random(zlib.crc32(f'{THEME}/{kind}/{v}'.encode())))
        sc.render.filepath = os.path.join(OUT, f'tile_{kind}_{v}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', THEME, kind, v)
