# SnapPix 🎬

**SnapPix** es una plataforma de video corto en formato vertical diseñada para la creación, descubrimiento y distribución algorítmica de contenido multimedia en tiempo real.

---

## ⚡ Características Principales

* **Feed Infinito (Para Ti):** Recomendación algorítmica basada en señales de interacción inmediata (tiempo de visualización, likes, compartidos).
* **Editor de Contenido:** Carga de video, herramientas de corte, superposición de audio/música y aplicación de filtros.
* **Social Hub:** Sistema de likes, comentarios en hilo, guardados, duetos y compartido multiplataforma.
* **Streaming de Baja Latencia:** Reproducción fluida optimizada mediante segmentación HLS / DASH y compresión adaptable.
* **Perfil de Creador:** Panel con estadísticas de rendimiento, métricas de retención y gestión de seguidores.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Mobile App** | React Native / Flutter |
| **Backend API** | Node.js (NestJS) / Go |
| **Video Processing** | FFmpeg / AWS Elemental MediaConvert |
| **Base de Datos** | PostgreSQL (Persistencia) + Redis (Feed Cache) |
| **Almacenamiento / CDN** | AWS S3 + Cloudflare CDN |

---

## 🚀 Instalación y Configuración

```bash
# 1. Clonar el repositorio
git clone [https://github.com/tu-usuario/snappix.git](https://github.com/tu-usuario/snappix.git)
cd snappix

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Iniciar en entorno de desarrollo
npm run dev
