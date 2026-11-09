/** A question's type in the Questions library's words; `null` for an unknown or absent one. */
export function questionTypeLabel(type: string | null | undefined): string | null {
  switch (type) {
    case 'SINGLE_SELECT':
      return $localize`:@@qedit.type_single:One choice`;
    case 'MULTI_SELECT':
      return $localize`:@@qedit.type_multi:Several choices`;
    case 'NUMERIC':
      return $localize`:@@qedit.type_numeric:Number`;
    case 'TEXT':
      return $localize`:@@qedit.type_text:Text`;
    default:
      return null;
  }
}
