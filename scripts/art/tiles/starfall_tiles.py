# 《星墜殘響》的地塊：用 Blender（Cycles）把每種地形渲染成等角的柱狀圖，取代遊戲裡用 Canvas 畫的版本。
#
#   blender -b --factory-startup -P scripts/art/tiles/starfall_tiles.py -- <輸出資料夾> [地形 ...]
#   py scripts/art/tiles/pack_tiles.py <輸出資料夾> public/assets/starfall/tiles.webp
#
# 每張 192×480（遊戲裡縮成 96×240）：菱形頂面的中心在 (96, 168)，側面往下延伸、由 pack_tiles.py 淡出。
# 投影跟單位圖表一樣：正交鏡頭、俯角 30°、yaw 45°，所以一格的菱形是 2:1；一層高度 = 畫面上 48 px。
# 光從畫面左上來（朝左下的面受光、朝右下的面背光），跟遊戲裡的陰影方向一致。
import bpy, sys, math, random, os
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
ONLY = set(args[1:])
os.makedirs(OUT, exist_ok=True)

W, H = 192, 480
PX = W / math.sqrt(2)             # 一個世界單位在畫面上的寬度（像素）
LEVEL = 48 / (PX * math.cos(math.radians(30)))   # 一層高度（世界單位）
DEPTH = 264 / (PX * math.cos(math.radians(30)))  # 側面往下畫多長
VARIANTS = {'ice': 8, 'snow': 3, 'deck': 3, 'grate': 3, 'rubble': 3, 'barricade': 3, 'wall': 3, 'machine': 3}


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
    # 光：一盞從畫面左上來的太陽，加上偏藍的環境光
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 4.6
    sun.data.angle = math.radians(8)
    # 光線的方向：主要打在朝左下的面（法線 +x），朝右下的面（法線 +y）只擦到一點
    sun.rotation_euler = Vector((-0.78, -0.12, -0.62)).to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(sun)
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = rgb(0x9fc4e8)
    bg.inputs[1].default_value = 0.6
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


def build(kind, v):
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


sc = None
for kind, n in VARIANTS.items():
    if ONLY and kind not in ONLY:
        continue
    for v in range(n):
        sc = reset()
        build(kind, v)
        sc.render.filepath = os.path.join(OUT, f'tile_{kind}_{v}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', kind, v)
