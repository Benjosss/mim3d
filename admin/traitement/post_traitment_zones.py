import os
import subprocess
import time

def treat_zones_glb():
    os.makedirs('sized', exist_ok=True)
    os.makedirs('impostors', exist_ok=True)

    files = [f for f in os.listdir('.') if os.path.isfile(f) and f.lower().endswith('.glb')]

    visual_files = [f for f in files if not f.lower().startswith("simp_col_")]

    for file in visual_files:
        file_age = time.time() - os.path.getmtime(file)

        # Intervertir les commentaires pour que le script traite les fichiers agés de moins de 10 minutes.
        if True:
        # if file_age < 600 :

            name_part, extension = os.path.splitext(file)
            col_file = f"simp_col_{file}"
            has_col = col_file in files

            output_file_sized = f"sized/{name_part}_sized{extension}"
            output_col_file_sized = f"sized/simp_col_{name_part}_sized{extension}"
            output_merged_sized = f"sized/{name_part}_sized{extension}"

            # Fichiers visuels  
            try:
                print(f"--- Traitement de : {file} ---\n")

                subprocess.run(["gltf-transform", "resize", file, output_file_sized, "--width", "1024", "--height", "1024"], check=True, shell=True)
                subprocess.run(["gltf-transform", "join",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "flatten",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "weld",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "prune",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "dedup",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "etc1s",  output_file_sized, output_file_sized, "--quality", "255"], check=True, shell=True)
                subprocess.run(["gltf-transform", "draco",  output_file_sized, output_file_sized], check=True, shell=True)
                print(f"✅ Succès : {output_file_sized}\n")


            except subprocess.CalledProcessError as e:
                print(f"❌ Erreur sur {file} : {e}\n")

            # Fichiers de collisions
            if(has_col):
                try:
                    print(f"--- Traitement de : simp_col_{file} ---\n")

                    # subprocess.run(["gltf-transform", "resize", file, output_file_sized, "--width", "1024", "--height", "1024"], check=True, shell=True)
                    subprocess.run(["gltf-transform", "join",  col_file, output_col_file_sized], check=True, shell=True)
                    subprocess.run(["gltf-transform", "flatten",  output_col_file_sized, output_col_file_sized], check=True, shell=True)
                    subprocess.run(["gltf-transform", "weld",  output_col_file_sized, output_col_file_sized], check=True, shell=True)
                    subprocess.run(["gltf-transform", "prune",  output_col_file_sized, output_col_file_sized], check=True, shell=True)
                    subprocess.run(["gltf-transform", "dedup",  output_col_file_sized, output_col_file_sized], check=True, shell=True)
                    # subprocess.run(["gltf-transform", "etc1s",  output_col_file_sized, output_col_file_sized, "--quality", "255"], check=True, shell=True)
                    subprocess.run(["gltf-transform", "draco",  output_col_file_sized, output_col_file_sized], check=True, shell=True)

                    print(f"✅ Succès : {output_col_file_sized}\n")


                except subprocess.CalledProcessError as e:
                    print(f"❌ Erreur sur {file} : {e}\n")

            if (has_col):
                try:
                    subprocess.run(["gltf-transform", "merge", output_file_sized, output_col_file_sized, output_merged_sized, "--merge_scenes"], check=True, shell=True)
                    
                    if os.path.exists(output_col_file_sized): os.remove(output_col_file_sized)
                    
                    print(f"SUCCÈS TOTAL : {output_merged_sized}\n")
                except subprocess.CalledProcessError as e:
                    print(f"❌ Échec de la fusion de la zone {name_part} : {e}\n")


        # IMPOSTORS
        # if True:
        if file_age < 600 : 

            name_part, extension = os.path.splitext(file)
            col_file = f"simp_col_{file}"
            has_col = col_file in files

            output_file_sized = f"impostors/imp_{name_part}_sized{extension}"
            output_col_file_sized = f"impostors/imp_simp_col_{name_part}_sized{extension}"
            output_merged_sized = f"impostors/imp_{name_part}_sized{extension}"

            # Fichiers visuels  
            try:
                print(f"--- Traitement IMPOSTEUR de : {file} ---\n")

                subprocess.run(["gltf-transform", "resize", file, output_file_sized, "--width", "512", "--height", "512"], check=True, shell=True)
                subprocess.run(["gltf-transform", "join",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "flatten",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "weld",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "prune",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "dedup",  output_file_sized, output_file_sized], check=True, shell=True)
                subprocess.run(["gltf-transform", "etc1s",  output_file_sized, output_file_sized, "--quality", "200"], check=True, shell=True)
                subprocess.run(["gltf-transform", "draco",  output_file_sized, output_file_sized], check=True, shell=True)
                print(f"✅ Succès : {output_file_sized}\n")


            except subprocess.CalledProcessError as e:
                print(f"❌ Erreur sur {file} : {e}\n")

            # Fichiers de collisions
            if(has_col):
                try:
                    print(f"--- Traitement IMPOSTEUR de : simp_col_{file} ---\n")

                    # subprocess.run(["gltf-transform", "resize", file, output_file_sized, "--width", "1024", "--height", "1024"], check=True, shell=True)
                    subprocess.run(["gltf-transform", "join",  col_file, output_col_file_sized], check=True, shell=True)
                    subprocess.run(["gltf-transform", "flatten",  output_col_file_sized, output_col_file_sized], check=True, shell=True)
                    subprocess.run(["gltf-transform", "weld",  output_col_file_sized, output_col_file_sized], check=True, shell=True)
                    subprocess.run(["gltf-transform", "prune",  output_col_file_sized, output_col_file_sized], check=True, shell=True)
                    subprocess.run(["gltf-transform", "dedup",  output_col_file_sized, output_col_file_sized], check=True, shell=True)
                    # subprocess.run(["gltf-transform", "etc1s",  output_col_file_sized, output_col_file_sized, "--quality", "255"], check=True, shell=True)
                    subprocess.run(["gltf-transform", "draco",  output_col_file_sized, output_col_file_sized], check=True, shell=True)

                    print(f"✅ Succès : {output_col_file_sized}\n")


                except subprocess.CalledProcessError as e:
                    print(f"❌ Erreur sur {file} : {e}\n")

            if (has_col):
                try:
                    subprocess.run(["gltf-transform", "merge", output_file_sized, output_col_file_sized, output_merged_sized, "--merge_scenes"], check=True, shell=True)
                    
                    if os.path.exists(output_col_file_sized): os.remove(output_col_file_sized)
                    
                    print(f"SUCCÈS TOTAL : {output_merged_sized}\n")
                except subprocess.CalledProcessError as e:
                    print(f"❌ Échec de la fusion de la zone {name_part} : {e}\n")


if __name__ == "__main__":
    treat_zones_glb()