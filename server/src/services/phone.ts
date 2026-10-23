// የኢትዮጵያ ስልክ ቁጥሮችን ወደ አንድ ቅርጽ (+2519XXXXXXXX) ያመጣል፤ ትክክል ካልሆነ null
export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s\-().]/g, "");
  if (/^0\d{9}$/.test(s)) s = "+251" + s.slice(1);
  else if (/^251\d{9}$/.test(s)) s = "+" + s;
  else if (/^[79]\d{8}$/.test(s)) s = "+251" + s;
  return /^\+\d{9,15}$/.test(s) ? s : null;
}