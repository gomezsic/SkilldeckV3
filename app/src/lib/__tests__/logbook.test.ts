import { describe, expect, it } from 'vitest'
import { checkEntry, overlaps, readSeasonFile, roleFromLabel } from '../logbook'
import type { LogEntry } from '../types'

const HEADER = 'Data inizio,Zona di navigazione,Modello barca,Nome barca,LOA (m),Vela / Motore,Ruolo,Miglia (NM),Giorni in mare,Notti in mare,Ore notturne,Miglia notturne (NM),Tidal,Note'
const csv = (...rows: string[]) => new File([[HEADER, ...rows].join('\n')], 'stagione.csv', { type: 'text/csv' })
const entry = (from: string, to: string): LogEntry => ({ id: 'x', from_date: from, to_date: to, route: 'Già presente', miles: 10, days: 1, nights: 0, source: 'declared' })

describe('file della stagione', () => {
  it('legge il file di esempio dell\'owner', async () => {
    const r = await readSeasonFile(csv('2026-08-30,Dalmazia,46 Cruiser,Bavaria 46 Cruiser,14.27,sail,Captain (Skipper),120,4,1,6,25,false,',
      '2026-07-05,Cicladi,508,Hanse 508,15.55,sail,Deckhand (Coskipper),200,10,0,0,0,false,', '2026-06-10,Bretagna,Motor vessel example,,12,power,Captain (Skipper),80,5,,,,true,'), [])
    expect(r.fileProblem).toBeNull()
    expect(r.rows.filter((x) => x.row)).toHaveLength(3)
    expect(r.rows[0].row).toMatchObject({ from_date: '2026-08-30', to_date: '2026-09-02', miles: 120, days: 4, propulsion: 'sail', role_on_board: 'skipper', is_tidal: false })
    expect(r.rows[1].row).toMatchObject({ role_on_board: 'co_skipper' })
    expect(r.rows[2].row).toMatchObject({ propulsion: 'power', is_tidal: true, nights: null })
  })
  it('accetta date italiane, virgole decimali e il punto e virgola', async () => {
    const f = new File([[HEADER.replaceAll(',', ';'), '30/08/2025;Sardegna;;;12,5;vela;Skipper;90,5;3;;;;;'].join('\n')], 's.csv', { type: 'text/csv' })
    const r = await readSeasonFile(f, [])
    expect(r.rows[0].row).toMatchObject({ from_date: '2025-08-30', miles: 90.5, loa_m: 12.5, propulsion: 'sail' })
  })
  it('spiega gli errori riga per riga', async () => {
    const r = await readSeasonFile(csv('2026-13-40,Elba,,,,sail,Skipper,50,2,,,,,', '2025-05-01,,,,,sail,Skipper,abc,2,,,,,', '2025-05-10,Elba,,,,sail,Skipper,5000,2,,,,,'), [])
    expect(r.rows.every((x) => !x.row)).toBe(true)
    expect(r.rows[0].problems.join()).toMatch(/non si legge/)
    expect(r.rows[1].problems.join()).toMatch(/zona/)
    expect(r.rows[1].problems.join()).toMatch(/non è un numero/)
    expect(r.rows[2].problems.join()).toMatch(/troppe/)
  })
  it('salta le navigazioni sovrapposte, nel logbook e nel file', async () => {
    const r = await readSeasonFile(csv('2025-06-02,Elba,,,,sail,Skipper,50,3,,,,,', '2025-07-01,Giglio,,,,sail,Skipper,50,5,,,,,', '2025-07-03,Capraia,,,,sail,Skipper,50,2,,,,,'), [entry('2025-06-01', '2025-06-05')])
    expect(r.rows[0].overlap).toMatch(/già nel tuo logbook/)
    expect(r.rows[1].row).not.toBeNull()
    expect(r.rows[2].overlap).toMatch(/questo file/)
  })
  it('rifiuta un file senza le colonne obbligatorie', async () => {
    const r = await readSeasonFile(new File(['Data inizio,Note\n2025-01-01,x'], 's.csv', { type: 'text/csv' }), [])
    expect(r.fileProblem).toMatch(/mancano le colonne/)
  })
})
describe('regole del logbook', () => {
  it('il giorno di cambio barca non è una sovrapposizione', () => {
    expect(overlaps({ from_date: '2025-06-01', to_date: '2025-06-07' }, { from_date: '2025-06-07', to_date: '2025-06-14' })).toBe(false)
    expect(overlaps({ from_date: '2025-06-01', to_date: '2025-06-07' }, { from_date: '2025-06-06', to_date: '2025-06-14' })).toBe(true)
    expect(overlaps({ from_date: '2025-06-01', to_date: '2025-06-01' }, { from_date: '2025-06-01', to_date: '2025-06-01' })).toBe(true)
  })
  it('controlla giorni, notti e miglia', () => {
    expect(checkEntry({ from_date: '2025-06-01', to_date: '2025-06-03', miles: 100, days: 3, nights: 2 })).toEqual([])
    expect(checkEntry({ from_date: '2025-06-01', to_date: '2025-06-03', miles: 100, days: 5, nights: 2 }).join()).toMatch(/giorni in mare/)
    expect(checkEntry({ from_date: '2025-06-03', to_date: '2025-06-01', miles: 1, days: 1, nights: 0 }).join()).toMatch(/prima/)
    expect(checkEntry({ from_date: '2999-06-01', to_date: '2999-06-03', miles: 1, days: 1, nights: 0 }).join()).toMatch(/futuro/)
  })
  it('riconosce i ruoli', () => {
    expect(roleFromLabel('Captain (Skipper)')).toBe('skipper'); expect(roleFromLabel('Deckhand (Coskipper)')).toBe('co_skipper')
    expect(roleFromLabel('Hostess/Steward')).toBe('hostess'); expect(roleFromLabel('Chef')).toBe('cook'); expect(roleFromLabel('Crew')).toBeNull()
  })
})
