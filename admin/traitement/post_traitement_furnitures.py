import os
import subprocess
import time

def treat_zones_glb():
    os.makedirs('furnitures', exist_ok=True)

    files = [f for f in os.listdir('.') if os.path.isfile(f) and f.lower().endswith('.glb')]

    visual_files = [f for f in files]

    for file in visual_files:
        file_age = time.time() - os.path.getmtime(file)

        # Intervertir les commentaires pour que le script traite les fichiers agés de moins de 10 minutes.
        if True:
        # if file_age < 600:

            name_part, extension = os.path.splitext(file)


            output_file_sized = f"furnitures/fur_{name_part}_sized{extension}"

            # Fichiers visuels  
            try:
                print(f"--- Traitement de : {file} ---\n")

                subprocess.run(["gltf-transform", "resize", file, output_file_sized, "--width", "1024", "--height", "1024"], check=True, shell=True)
                subprocess.run(["gltf-transform", "weld",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "dedup",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "instance",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "join",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "flatten",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "prune",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "etc1s",  output_file_sized, output_file_sized, "--quality", "255"], check=True, shell=True)
                subprocess.run(["gltf-transform", "draco",  output_file_sized, output_file_sized], check=True, shell=True)
                print(f"✅ Succès : {output_file_sized}\n")



            except subprocess.CalledProcessError as e:
                print(f"❌ Erreur sur {file} : {e}\n")



if __name__ == "__main__":
    treat_zones_glb()