"""Offline stills of the shipped educational GLB; never runs in the browser."""
import bpy, sys
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'app/models/single-bell.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
corners=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
lo=Vector(tuple(min(v[i] for v in corners) for i in range(3)))
hi=Vector(tuple(max(v[i] for v in corners) for i in range(3)))
height=hi.z-lo.z;center=(lo+hi)*.5
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.use_denoising=True;scene.render.film_transparent=True
scene.render.resolution_x=768;scene.render.resolution_y=1408;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=.35
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.34,.29,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
def area(name,offset,energy,color,size):
    light=bpy.data.lights.new(name,'AREA');light.energy=energy*height*height;light.color=color;light.shape='DISK';light.size=size*height
    obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=center+Vector(offset)*height
    obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
area('Warm hall light',(-1.9,-2,2.5),110,(1,.86,.63),3)
area('Soft return',(2,-.4,1),65,(.66,.84,.79),2)
area('Bronze rim',(-1,1.5,2),100,(1,.92,.75),2)
camera=bpy.data.objects.new('Poster camera',bpy.data.cameras.new('Poster camera'));scene.collection.objects.link(camera);scene.camera=camera
camera.data.type='ORTHO';camera.data.ortho_scale=height*1.10
camera.location=center+Vector((-.40,-3.5,.28))*height;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(out/'home-bell-poster.png');bpy.ops.wm.save_as_mainfile(filepath=str(out/'home-posters.blend'))
bpy.ops.render.render(write_still=True)
# The same real mesh, cut through its front half, for the static cavity study.
import bmesh
for obj in meshes:
    bm=bmesh.new();bm.from_mesh(obj.data)
    inverse=obj.matrix_world.inverted();plane=inverse@Vector((center.x,center.y,center.z))
    normal=obj.matrix_world.to_3x3().transposed()@Vector((0,-1,0))
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=plane,plane_no=normal,clear_outer=True,clear_inner=False)
    bm.to_mesh(obj.data);bm.free();obj.data.update()
area('Cavity fill',(0,-1.1,-.1),18,(.88,.96,1),1.2)
camera.location=center+Vector((1.45,-3.5,-.32))*height
camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(out/'home-bell-section.png');bpy.ops.render.render(write_still=True)
print('POSTERS_COMPLETE',str(out),flush=True)
