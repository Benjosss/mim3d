bl_info = {
    "name": "NOCOL Renamer",
    "author": "Custom",
    "version": (1, 0),
    "blender": (3, 0, 0),
    "location": "3D Viewport > Alt+N (Object Mode)",
    "description": "Ajoute le préfixe NOCOL_ aux objets et meshes sélectionnés",
    "category": "Object",
}

import bpy


# ─────────────────────────────────────────────
#  Opérateur
# ─────────────────────────────────────────────

class OBJECT_OT_nocol_rename(bpy.types.Operator):
    """Ajoute le préfixe NOCOL_ au nom des objets et de leurs meshes sélectionnés"""
    bl_idname = "object.nocol_rename"
    bl_label = "NOCOL : Renommer la sélection"
    bl_options = {'REGISTER', 'UNDO'}

    prefix: bpy.props.StringProperty(default="NOCOL_")

    @classmethod
    def poll(cls, context):
        return (
            context.mode == 'OBJECT'
            and len(context.selected_objects) > 0
        )

    def execute(self, context):
        renamed = 0
        prefix = self.prefix

        for obj in context.selected_objects:
            # Renommer l'objet s'il n'a pas déjà le préfixe
            if not obj.name.startswith(prefix):
                obj.name = prefix + obj.name

            # Renommer le mesh (ou autre données) s'il existe
            if obj.data and not obj.data.name.startswith(prefix):
                obj.data.name = prefix + obj.data.name

            renamed += 1

        self.report({'INFO'}, f"{renamed} objet(s) renommé(s) avec le préfixe '{prefix}'.")
        return {'FINISHED'}


# ─────────────────────────────────────────────
#  Raccourci clavier
# ─────────────────────────────────────────────

addon_keymaps = []

def register_keymap():
    wm = bpy.context.window_manager
    kc = wm.keyconfigs.addon
    if kc:
        km = kc.keymaps.new(name='Object Mode', space_type='EMPTY')
        kmi = km.keymap_items.new(
            OBJECT_OT_nocol_rename.bl_idname,
            type='N',
            value='PRESS',
            alt=True        # Alt+N
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
    bpy.utils.register_class(OBJECT_OT_nocol_rename)
    register_keymap()
    print("[NOCOL] Addon enregistré — Raccourci : Alt+N (Object Mode)")

def unregister():
    unregister_keymap()
    bpy.utils.unregister_class(OBJECT_OT_nocol_rename)
    print("[NOCOL] Addon désactivé.")

if __name__ == "__main__":
    register()