/**
 * The hero shoe, hanging by its laces from the top of the composition.
 *
 * Drawn as inline SVG rather than shipped as a photo: it stays crisp at every
 * width, costs a few kilobytes, adapts to light and dark mode through the
 * `tone` props, and needs no image request on the critical path.
 *
 * The laces run off the top edge of the viewBox on purpose — the shoe should
 * read as suspended from somewhere above the frame.
 */
export function HangingShoe({
  className,
  body = "#9A1C21",
  accent = "#7C1418",
  sole = "#EEE6DD",
  lace = "#EEE6DD",
  shadow = "#2B1A17",
}: {
  className?: string;
  body?: string;
  accent?: string;
  sole?: string;
  lace?: string;
  shadow?: string;
}) {
  return (
    <svg
      viewBox="0 0 560 780"
      className={className}
      role="img"
      aria-label="کتانی لوران که از بند کفش آویزان است"
    >
      <defs>
        <linearGradient id="hero-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={body} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
        <linearGradient id="hero-sole" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sole} />
          <stop offset="100%" stopColor={sole} stopOpacity="0.82" />
        </linearGradient>
        <radialGradient id="hero-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={shadow} stopOpacity="0.28" />
          <stop offset="100%" stopColor={shadow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft contact shadow on the floor below */}
      <ellipse cx="268" cy="742" rx="180" ry="26" fill="url(#hero-shadow)" />

      <g transform="translate(268 448) rotate(-70) scale(0.46) translate(-470 -330)">
        {/* --- upper --- */}
        <path
          d="M70 486 C62 418 108 366 190 330 C276 292 348 254 408 210
             C454 178 518 128 578 108 C618 148 652 176 684 190
             C726 166 764 148 798 160 C842 192 872 330 884 486 Z"
          fill="url(#hero-body)"
        />
        {/* vamp shading */}
        <path
          d="M70 486 C62 418 108 366 190 330 C276 292 348 254 408 210 L436 250
             C368 296 288 334 202 368 C144 392 108 434 106 486 Z"
          fill={shadow}
          opacity="0.16"
        />
        {/* toe cap */}
        <path d="M70 486 C62 418 108 366 190 330 L244 402 C180 428 132 452 114 486 Z" fill={sole} opacity="0.1" />
        {/* heel counter */}
        <path d="M684 190 C726 166 764 148 798 160 C842 192 872 330 884 486 L800 486 C792 366 770 236 720 200 Z" fill={accent} />
        {/* side stripe */}
        <path
          d="M300 404 C388 382 468 342 538 296 L568 274 L592 330 L560 352
             C486 400 400 438 314 458 Z"
          fill={sole}
          opacity="0.82"
        />
        {/* lace panel + eyelets */}
        <path d="M408 210 C454 178 518 128 578 108 L596 154 C540 174 486 216 436 250 Z" fill={shadow} opacity="0.2" />
        <g fill={shadow} opacity="0.4">
          <circle cx="452" cy="236" r="7" /><circle cx="528" cy="198" r="7" />
          <circle cx="486" cy="270" r="7" /><circle cx="560" cy="234" r="7" />
        </g>
        {/* tongue */}
        <path d="M574 112 C606 130 636 156 664 186 L640 214 C614 188 588 166 558 152 Z" fill={sole} opacity="0.35" />

        {/* --- sole unit --- */}
        <path d="M54 486 C54 458 78 444 112 444 L852 444 C886 444 906 460 906 488 L906 516 L54 516 Z" fill="url(#hero-sole)" />
        <path d="M54 516 L906 516 L906 540 C906 562 886 574 852 574 L108 574 C74 574 54 560 54 538 Z" fill={sole} opacity="0.72" />
        <path d="M86 486 L876 486" stroke={shadow} strokeWidth="3" opacity="0.18" fill="none" />
      </g>

      {/* Laces run off the top edge and land on the upper's top eyelets. */}
      <g stroke={lace} strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M244 0 C238 96 230 186 226 268 C220 322 222 374 228 414" />
        <path d="M296 0 C300 100 296 190 288 266 C280 318 272 366 266 398" />
        <circle cx="228" cy="414" r="5" fill={lace} stroke="none" />
        <circle cx="266" cy="398" r="5" fill={lace} stroke="none" />
      </g>
    </svg>
  );
}
