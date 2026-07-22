import Image from 'next/image';

type BirdLogoProps = {
  size?: number;
  className?: string;
};

export default function BirdLogo({ size = 32, className }: BirdLogoProps) {
  return (
    <span
      role="img"
      aria-label="家庭账本 logo"
      className={['bird-logo', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    >
      <Image
        className="bird-logo__image"
        src="/logo-bird-a-light.png"
        alt=""
        width={512}
        height={512}
        aria-hidden="true"
        draggable={false}
      />
    </span>
  );
}
