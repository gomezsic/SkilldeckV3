import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// La versione pubblicata: i primi caratteri del commit e la data. Serve al registro degli errori per sapere su quale versione è successo.
const version = `${(process.env.GITHUB_SHA ?? 'locale').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
})
