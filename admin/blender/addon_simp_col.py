bl_info = {
    "name": "SIMP_COL",
    "author": "Custom",
    "version": (1, 0),
    "blender": (3, 0, 0),
    "location": "3D Viewport > Alt+S",
    "description": "Duplique la sélection, la place dans SIMP_COL et joint en un objet avec matériau unique",
    "category": "Object",
}

import bpy


# ─────────────────────────────────────────────
#  Logique principale
# ─────────────────────────────────────────────

def simp_col_process(context):
    """
    Duplique la sélection active sans la déplacer,
    ajoute les duplicatas dans une collection 'SIMP_COL',
    joint tout en un seul objet nommé 'SIMP_COL',
    puis remplace tous les matériaux par un Principled BSDF unique.
    """

    if context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')

    selected_objects = context.selected_objects
    if not selected_objects:
        return {'CANCELLED'}

    print(f"[SIMP_COL] {len(selected_objects)} objet(s) sélectionné(s).")

    # --- Collection SIMP_COL ---
    col_name = "SIMP_COL"
    if col_name in bpy.data.collections:
        simp_col = bpy.data.collections[col_name]
    else:
        simp_col = bpy.data.collections.new(col_name)
        context.scene.collection.children.link(simp_col)

    # --- Duplication sans déplacement ---
    bpy.ops.object.duplicate(linked=False, mode='TRANSLATION')
    duplicated_objects = list(context.selected_objects)
    print(f"[SIMP_COL] {len(duplicated_objects)} objet(s) dupliqué(s).")

    # --- Déplacer dans SIMP_COL ---
    for obj in duplicated_objects:
        for col in list(obj.users_collection):
            col.objects.unlink(obj)
        simp_col.objects.link(obj)

    # --- Join ---
    bpy.ops.object.select_all(action='DESELECT')
    for obj in duplicated_objects:
        obj.select_set(True)
    context.view_layer.objects.active = duplicated_objects[0]
    bpy.ops.object.join()

    joined_obj = context.active_object
    joined_obj.name = col_name
    if joined_obj.data:
        joined_obj.data.name = col_name

    print(f"[SIMP_COL] Objets joints en '{joined_obj.name}'.")

    # --- Matériau unique ---
    mat_name = "SIMP_COL_Mat"
    joined_obj.data.materials.clear()

    if mat_name in bpy.data.materials:
        base_mat = bpy.data.materials[mat_name]
    else:
        base_mat = bpy.data.materials.new(name=mat_name)
        base_mat.use_nodes = True
        base_mat.node_tree.nodes.clear()
        bsdf = base_mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output = base_mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
        base_mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        bsdf.location = (0, 0)
        output.location = (300, 0)

    joined_obj.data.materials.append(base_mat)
    for poly in joined_obj.data.polygons:
        poly.material_index = 0

    print(f"[SIMP_COL] Matériau '{mat_name}' assigné. Terminé !")
    return {'FINISHED'}


# ─────────────────────────────────────────────
#  Opérateur Blender
# ─────────────────────────────────────────────

class OBJECT_OT_simp_col(bpy.types.Operator):
    """Duplique la sélection → SIMP_COL (collection + objet joint + matériau unique)"""
    bl_idname = "object.simp_col"
    bl_label = "SIMP_COL : Dupliquer & Simplifier"
    bl_options = {'REGISTER', 'UNDO'}

    @classmethod
    def poll(cls, context):
        return (
            context.mode == 'OBJECT'
            and len(context.selected_objects) > 0
        )

    def execute(self, context):
        result = simp_col_process(context)
        if result == {'CANCELLED'}:
            self.report({'WARNING'}, "Aucun objet sélectionné.")
        return result


# ─────────────────────────────────────────────
#  Raccourci clavier
# ─────────────────────────────────────────────

addon_keymaps = []

def register_keymap():
    wm = bpy.context.window_manager
    kc = wm.keyconfigs.addon
    if kc:
        # Raccourci actif dans la 3D Viewport en mode Object
        km = kc.keymaps.new(name='Object Mode', space_type='EMPTY')
        kmi = km.keymap_items.new(
            OBJECT_OT_simp_col.bl_idname,
            type='S',           # Touche S
            value='PRESS',
            alt=True            # Alt + S
        )
        addon_keymaps.append((km, kmi))

def unregister_keymap():
    for km, kmi in addon_keymaps:
        km.keymap_items.remove(kmi)
    addon_keymaps.clear()


# ─────────────────────────────────────────────
#  Register / Unregister
# ─────────────────────────────────────────────

def register():
    bpy.utils.register_class(OBJECT_OT_simp_col)
    register_keymap()
    print("[SIMP_COL] Addon enregistré — Raccourci : Alt+S (Object Mode)")

def unregister():
    unregister_keymap()
    bpy.utils.unregister_class(OBJECT_OT_simp_col)
    print("[SIMP_COL] Addon désactivé.")

if __name__ == "__main__":
    register()