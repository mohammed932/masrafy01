import {
  CAR_FIGURES,
  type CarBand,
  type CarException,
  type CarExceptionKind,
  type CarFigure,
  isFuelKind,
} from './car-pricing.rules';

/**
 * The words the car pricing card is read in (v37.0.0) — one copy for the card and for every
 * page that shows a program's pricing back, so "Brand BMW · all bands → Rate 9%" reads the
 * same on the form and on the detail page.
 */

export const CAR_FIGURE_LABEL: Record<CarFigure, string> = {
  rate: $localize`:@@carPricing.fig.rate:Rate`,
  maxYears: $localize`:@@carPricing.fig.maxYears:Longest term`,
  insurance: $localize`:@@carPricing.fig.insurance:Insurance`,
  interestFreeYears: $localize`:@@carPricing.fig.interestFree:Interest-free`,
  oldestCar: $localize`:@@carPricing.fig.oldestCar:Oldest car`,
};

export const CAR_FIGURE_UNIT: Record<CarFigure, string> = {
  rate: '%',
  maxYears: $localize`:@@carPricing.unit.years:years`,
  insurance: $localize`:@@carPricing.unit.perYear:% a year`,
  interestFreeYears: $localize`:@@carPricing.unit.years:years`,
  oldestCar: $localize`:@@carPricing.unit.yearsOld:years old`,
};

export const CAR_KIND_LABEL: Record<CarExceptionKind, string> = {
  category: $localize`:@@carPricing.kind.category:Category`,
  brand: $localize`:@@carPricing.kind.brand:Brand`,
  gas: $localize`:@@carPricing.kind.gas:Gas`,
  electric: $localize`:@@carPricing.kind.electric:Electric`,
};

/** "25" → "25", "2.5000" → "2.5". */
function trim(v: string): string {
  return /^\d+\.\d+$/.test(v) ? v.replace(/0+$/, '').replace(/\.$/, '') : v;
}

export function carBandText(band: CarBand): string {
  return band.to === null || band.to === ''
    ? $localize`:@@carPricing.bandOpen:${trim(band.from)}:FROM:% and above`
    : `${trim(band.from)}–${trim(band.to)}%`;
}

export function carFigureText(f: CarFigure, value: string): string {
  return `${CAR_FIGURE_LABEL[f]} ${trim(value)}${f === 'rate' ? '%' : ' ' + CAR_FIGURE_UNIT[f]}`;
}

/** "Brand BMW · all bands → Rate 9% · Longest term 5 years". */
export function carExceptionSentence(
  ex: CarException,
  bands: readonly CarBand[],
  nameOf: (ex: CarException) => string,
): string {
  const who = isFuelKind(ex.kind)
    ? CAR_KIND_LABEL[ex.kind]
    : `${CAR_KIND_LABEL[ex.kind]} ${nameOf(ex)}`;
  const on =
    ex.bands === 'all'
      ? $localize`:@@carPricing.allBandsShort:all bands`
      : ex.bands
          .map((b) => bands[b])
          .filter((b): b is CarBand => b !== undefined)
          .map(carBandText)
          .join(', ');
  const what = CAR_FIGURES.filter((f) => (ex.figures[f] ?? '') !== '')
    .map((f) => carFigureText(f, ex.figures[f]!))
    .join(' · ');
  return `${who} · ${on} → ${what || '…'}`;
}
