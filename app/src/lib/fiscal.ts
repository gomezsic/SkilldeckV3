/** Controlli sui dati fiscali: trovano gli errori di battitura prima di salvare. Restituiscono il problema, o null se va bene. */
const ODD: Record<string, number> = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 }
export function taxCodeProblem(v: string): string | null {
  const s = v.toUpperCase().replace(/\s/g, '')
  if (s.length !== 16) return `Il codice fiscale ha 16 caratteri: ne hai scritti ${s.length}.`
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(s)) return 'Il codice fiscale non ha la forma giusta: controlla lettere e numeri.'
  let sum = 0
  for (let i = 0; i < 15; i++) { const c = s[i]; sum += i % 2 === 0 ? ODD[c] : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65 }
  return String.fromCharCode(65 + (sum % 26)) === s[15] ? null : 'Il codice fiscale contiene un errore di battitura: ricontrollalo carattere per carattere.'
}
export function vatProblem(v: string): string | null {
  const s = v.replace(/\s/g, '').replace(/^IT/i, '')
  if (!/^\d{11}$/.test(s)) return 'La partita IVA italiana ha 11 cifre.'
  let sum = 0
  for (let i = 0; i < 11; i++) { let d = Number(s[i]); if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 } sum += d }
  return sum % 10 === 0 ? null : 'La partita IVA contiene un errore di battitura: ricontrolla le cifre.'
}
export function ibanProblem(v: string): string | null {
  const s = v.toUpperCase().replace(/\s/g, '')
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return 'L\'IBAN non ha la forma giusta: controlla di averlo copiato tutto.'
  if (s.startsWith('IT') && s.length !== 27) return `Un IBAN italiano ha 27 caratteri: ne hai scritti ${s.length}.`
  const moved = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of moved) rem = (rem * 10 + Number(ch)) % 97
  return rem === 1 ? null : 'L\'IBAN contiene un errore di battitura: ricontrollalo.'
}
export const pecProblem = (v: string) => (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v.trim()) ? null : 'L\'indirizzo PEC non sembra completo: deve essere come nome@pec.it.')
export const sdiProblem = (v: string) => (/^[A-Z0-9]{7}$/.test(v.trim().toUpperCase()) ? null : 'Il codice SDI ha 7 caratteri fra lettere e numeri.')
