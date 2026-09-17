import Image from 'next/image';
import Link from 'next/link';
export function Brand() {
  return <Link href="/" className="brand" aria-label="Central Promo Pet — início"><Image src="/logo.webp" width={48} height={48} alt="" /><span>Central<span className="brand-accent">Promo Pet</span></span></Link>;
}
