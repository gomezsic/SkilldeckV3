import { describe, expect, it } from 'vitest'
import { ibanProblem, pecProblem, sdiProblem, taxCodeProblem, vatProblem } from '../fiscal'

describe('codice fiscale', () => {
  it('accetta un codice corretto', () => expect(taxCodeProblem('RSSMRA85T10A562S')).toBeNull())
  it('accetta minuscole e spazi', () => expect(taxCodeProblem('rssmra85t10a562s ')).toBeNull())
  it('scopre un carattere sbagliato', () => expect(taxCodeProblem('RSSMRA85T10A562X')).toMatch(/battitura/))
  it('dice quanti caratteri mancano', () => expect(taxCodeProblem('RSSMRA85T10A56')).toMatch(/14/))
})
describe('partita IVA', () => {
  it('accetta un numero corretto', () => expect(vatProblem('00743110157')).toBeNull())
  it('accetta il prefisso IT', () => expect(vatProblem('IT00743110157')).toBeNull())
  it('scopre una cifra sbagliata', () => expect(vatProblem('00743110158')).toMatch(/battitura/))
  it('chiede 11 cifre', () => expect(vatProblem('12345')).toMatch(/11 cifre/))
})
describe('IBAN', () => {
  it('accetta un IBAN italiano corretto', () => expect(ibanProblem('IT60 X054 2811 1010 0000 0123 456')).toBeNull())
  it('accetta un IBAN estero corretto', () => expect(ibanProblem('DE89370400440532013000')).toBeNull())
  it('scopre una cifra sbagliata', () => expect(ibanProblem('IT60X0542811101000000123457')).toMatch(/battitura/))
  it('controlla la lunghezza italiana', () => expect(ibanProblem('IT60X05428111010000001234')).toMatch(/27 caratteri/))
})
describe('PEC e SDI', () => {
  it('PEC', () => { expect(pecProblem('mario@pec.it')).toBeNull(); expect(pecProblem('mario@pec')).not.toBeNull() })
  it('SDI', () => { expect(sdiProblem('abc1234')).toBeNull(); expect(sdiProblem('ABC12')).not.toBeNull() })
})
