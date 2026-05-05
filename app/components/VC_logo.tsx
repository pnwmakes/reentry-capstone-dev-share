import Image from "next/image";

export default function VCLogo() {
  return (
    <div className="flex items-center">
      <Image src="/VC_logo.svg" alt="Victory Connect Logo" width={180} height={40} />
    </div>
  );
}