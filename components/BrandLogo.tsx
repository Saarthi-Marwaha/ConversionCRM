import Image from "next/image";
import logoImage from "@/assets/logo_CRM-removebg-preview.png";

/** The ConversionCRM logo mark (PNG with transparent background). */
export function BrandLogo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <Image src={logoImage} alt="ConversionCRM" className={className} priority />
  );
}
