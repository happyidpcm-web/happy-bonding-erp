# Happy Bonding ERP - Cloud VPS Deployment Guide
# (24/7 Cloud Server-ல் நிறுவும் வழிகாட்டி)

இந்த வழிகாட்டி **Happy Bonding ERP** பயன்பாட்டை ஒரு Cloud VPS (DigitalOcean, Hostinger, Hetzner, AWS) சர்வரில் 24 மணி நேரமும் (Laptop OFF-ல் இருந்தாலும்) இயங்குமாறு நிறுவுவதற்கான முழுமையான வழிமுறைகளை வழங்குகிறது.

---

## 📋 தேவையானவை (Prerequisites)

1. **Cloud VPS Server:** Ubuntu 22.04 LTS (குறைந்தது 1GB RAM, 1 vCPU, 25GB SSD).
2. **Domain Name:** `erp.happybonding.in`
3. **DNS Setting:** உங்கள் Domain Registrar (GoDaddy/Cloudflare/Namecheap)-ல் `erp.happybonding.in`-ன் **A Record**-ஐ உங்கள் VPS சர்வரின் Public IP முகவரிக்கு Point செய்யவும்.

---

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Server-ல் லாகின் செய்து Docker நிறுவுதல்

உங்கள் கம்ப்யூட்டர் Terminal / PuTTY வழியாக VPS சர்வரில் Login செய்யவும்:

```bash
ssh root@YOUR_SERVER_IP
```

தேவையான Docker & Git கருவிகளை நிறுவ இந்த Command-ஐ இயக்கவும்:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx docker.io docker-compose-v2
sudo systemctl enable --now docker nginx
```

---

### Step 2: Code-ஐ Server-க்கு கொண்டு வருதல் (Git Clone)

```bash
cd /var/www
git clone https://github.com/YOUR_GITHUB_REPO/happy-bonding-erp.git
cd happy-bonding-erp
```

*(குறிப்பு: Git இல்லாவிட்டால், உங்கள் Laptop-ல் இருந்து WinSCP அல்லது FileZilla வழியாகவும் Project Files-ஐ `/var/www/happy-bonding-erp` கோப்பிற்கு அனுப்பலாம்).*

---

### Step 3: Environment Variables (.env) அமைத்தல்

```bash
cp .env.production.example .env
nano .env
```

`.env` கோப்பில் உங்கள் ரகசிய கடவுச்சொற்களை மாற்றி சேமிக்கவும்:
- `POSTGRES_PASSWORD`: ஒரு வலுவான கடவுச்சொல்
- `JWT_SECRET`: ஒரு வலுவான ரகசிய குறியீடு

---

### Step 4: Automated Deployment Script-ஐ இயக்குதல்

Deploy script-க்கு permission கொடுத்து இயக்கவும்:

```bash
chmod +x deploy.sh
./deploy.sh
```

இந்த Command:
- Docker Image-ஐ உருவாக்கிக் கொள்ளும் (Build).
- PostgreSQL Database & Node.js Application-ஐ பின்னணியில் (Background) தொடங்க வைக்கும்.
- Database Tables-ஐத் தானாகவே Sync செய்யும்.

---

### Step 5: Nginx & Free SSL (HTTPS) அமைத்தல்

1. Nginx Config File-ஐ Copied செய்வது:

```bash
sudo cp nginx/conf.d/erp.happybonding.in.conf /etc/nginx/sites-available/erp.happybonding.in
sudo ln -s /etc/nginx/sites-available/erp.happybonding.in /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

2. Certbot மூலம் இலவச **Let's Encrypt SSL (HTTPS)** சான்றிதழ் பெறுவது:

```bash
sudo certbot --nginx -d erp.happybonding.in
```

Certbot உங்களின் Email கேட்கும், அதை வழங்கி `https` redirects-க்கு ஒப்புக்கொள்ளவும். Certbot தானாகவே SSL Certificate-ஐ புதுப்பித்துக் கொள்ளும் (Auto-renew).

---

## 🛡️ 24/7 Backup & Maintenance (தானியங்கி பேக்கப்)

- Happy Bonding ERP சர்வர் **தினமும் தானாகவே** `/app/backups` கோப்பகத்தில் Full JSON Backup எடுக்கும்.
- Docker Volume `happybonding_backups` வழியாக இவை பாதுகாப்பாக சர்வரில் இருக்கும்.

---

## 🔍 முக்கியமான கட்டளைகள் (Useful Commands)

| செயல்ப்பாடு | கட்டளை |
| :--- | :--- |
| **Server Status பாக்க** | `docker compose -f docker-compose.prod.yml ps` |
| **Live Logs பார்க்க** | `docker logs -f happybonding_app` |
| **App Restart செய்ய** | `docker compose -f docker-compose.prod.yml restart app` |
| **புதிய Code Update செய்ய** | `git pull && ./deploy.sh` |

---

🎉 **வாழ்த்துக்கள்!** இப்போது **https://erp.happybonding.in** உங்களுடைய Laptop off-ல் இருந்தாலும் 24/7 தொடர்ந்து இயங்கும்!
