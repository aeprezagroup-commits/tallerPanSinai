import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const paquete = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

function obtenerGit() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
    const sucio = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
    return sucio ? `${sha}-dirty` : sha
  } catch {
    return 's/d'
  }
}

const fechaBuild = new Date().toISOString()

function generarVersionJson() {
  return {
    name: 'generar-version-json',
    writeBundle() {
      const destino = resolve(__dirname, 'dist', 'version.json')
      mkdirSync(dirname(destino), { recursive: true })
      writeFileSync(destino, JSON.stringify({ buildDate: fechaBuild }))
    }
  }
}

export default defineConfig({
  plugins: [react(), generarVersionJson()],
  define: {
    __APP_VERSION__: JSON.stringify(paquete.version),
    __BUILD_DATE__: JSON.stringify(fechaBuild),
    __GIT_SHA__: JSON.stringify(obtenerGit())
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) {
            return 'firebase';
          }
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
            return 'charts';
          }
        }
      }
    }
  }
})
