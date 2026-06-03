<img src="public/images/favicon.png" alt="logo" width="200"/>  

# Installation et utilisation du projet

## Prérequis :

Afin de pouvoir faire tourner le projet en local ou sur un serveur, il faut :
- Avoir installé Node.js + npm (la dernière version conviendra très bien)
- Avoir accès à un terminal de commande git
- Avoir l'accès au Repo Github (https://github.com/Benjosss/mim3d)

> Deux cas d'utilisation sont possibles :  
> I. Faire tourner en local (mode développement)  
> II. Faire tourner sur un serveur (Linux ici)

## I. Développement local :

### 1. Clone le projet sur sa machine

```bash
git clone https://github.com/Benjosss/mim3d.git
cd mim3d
```

### 2. Charger les dépendances 

```bash
npm install
```

### 3. Lancer le projet en local 

```bash
npm run dev
```

Dans la console un lien en "localhost" apparaitra, cliquer dessus pour l'ouvrir dans le navigateur.  
Chaque modification dans le code rechargera la page en direct (hot-reload).


## II. Déployer sur un serveur (Linux - Ubuntu) :

> Prérequis :  
> - Un accès physique au serveur ou à distance via accès SSH dans un terminal (accès admin).  
> - Toujours Node.js + npm


### 1. Clone le projet sur sa machine

```bash
cd ~
git clone https://github.com/Benjosss/mim3d.git
cd mim3d
```

### 2. Charger les dépendances

```bash
npm install
```

### 3. Build le projet

```bash
npm run build
```

Le build crée un dossier `dist/` contenant le site buildé

### 4. Installer Nginx (serveur web)

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 5. Ouvrir les ports du firewall

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistant save
```

> Si `netfilter-persitant` n'est pas installé :
> ```bash
> sudo apt install iptables-persistent -y
> ```

### 6. Configurer Nginx

```bash
sudo nano /etc/nginx/sites-available/default
```

Et remplacer tout le contenu du fichier par :

```nginx
server {
    listen 80;
    server_name _;
    root /home/ubuntu/mim3d/dist;
    index index.html;
    location = /UFRMIM {
        try_files /src/app/app.html =404;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Sauvegarder avec : **Ctrl+O → Entrée → Ctrl+X**

### 7. Corriger les permissions

```bash
sudo chmod 755 /home/ubuntu
sudo chmod -R 755 /home/ubuntu/mim3d/dist
```

### 8. Redémarrer Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

Le site est maintenant accessible sur `http://IP_PUBLIQUE_SERVEUR`

### BONUS

Si le code est mis à jour et que les modifications ont été "push" dans le repo, il faut mettre à jour la version du site sur le serveur :

```bash
cd ~/mim3d
git pull
npm run build
```

Nginx déploiera la nouvelle version à `http://IP_PUBLIQUE_SERVEUR`

#### Alias :

Pour rendre cette opération plus rapide sur le serveur faire :

```bash
echo "alias deploy='cd ~/mim3d && git pull && npm run build'" >> ~/.bashrc
source ~/.bashr
```

Plus besoin de taper les 3 commandes pour mettre à jour mais uniquement `deploy` dans le terminal.

<br>  

> Benjamin LALLEMENT - UFR MIM - Mis à jour le 02/06/2026  
> ATTENTION : Lien du repo Github succeptible de changer