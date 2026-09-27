/**
 * Generates the placeholder product imagery as SVG.
 *
 * The Loran brand already uses illustrated footwear in its social artwork, so
 * vector product shots read as intentional rather than as missing photos. They
 * are square (1:1) and identically framed, which is what keeps the product grid
 * from jumping when a product has a different photo.
 *
 * ▶ To move to real photography: drop files into `public/products/` using the
 *   same names and update nothing else — `src/data/products.ts` only stores paths.
 *
 *   node scripts/generate-product-images.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "products");
mkdirSync(OUT, { recursive: true });

const PAD = "#F1EBE4";      // warm studio pad, matches --surface-2
const PAD_DARK = "#E7DFD5";
const SHADOW = "#CFC3B5";

/** Slightly darken/lighten a hex colour for shading without a colour library. */
const shade = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(Math.min(255, Math.max(0, c + amount)))
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

/* -------------------------------------------------------------------------- */
/* Silhouettes — each returns the shoe group for a 1000×1000 canvas.           */
/* -------------------------------------------------------------------------- */

/** Low-top court sneaker, toe to the left, standing on the ground line y=700. */
const sneaker = (c) => `
  <g>
    <!-- upper -->
    <path d="M110 700 C102 640 148 592 228 558 C312 520 380 486 436 448 C480 420 542 374 600 356
             C638 368 670 392 700 420 C740 398 776 382 808 392 C850 422 878 560 890 700 Z" fill="${c.body}"/>
    <!-- vamp shading -->
    <path d="M110 700 C102 640 148 592 228 558 C312 520 380 486 436 448 L462 486
             C400 528 322 562 240 594 C184 616 150 654 146 700 Z" fill="${shade(c.body, -24)}" opacity="0.45"/>
    <!-- toe cap -->
    <path d="M110 700 C102 640 148 592 228 558 L278 626 C218 650 174 670 156 700 Z" fill="${shade(c.body, 20)}"/>
    <path d="M236 552 L286 620" stroke="${shade(c.body, -46)}" stroke-width="5" opacity="0.4" fill="none"/>
    <!-- heel counter -->
    <path d="M700 420 C740 398 776 382 808 392 C850 422 878 560 890 700 L812 700
             C806 590 788 480 742 430 Z" fill="${c.accent}"/>
    <!-- side stripe -->
    <path d="M330 618 C420 600 508 560 586 508 C614 490 640 476 664 470 L676 522
             C650 530 626 544 602 560 C524 612 434 652 344 668 Z" fill="${c.accent}" opacity="0.9"/>
    <!-- collar padding -->
    <path d="M600 356 C638 368 670 392 700 420 L672 442 C648 418 624 396 594 386 Z" fill="${shade(c.body, 26)}"/>
    <!-- lace panel + eyelets -->
    <path d="M436 448 C480 420 542 374 600 356 L614 400 C562 414 512 448 462 486 Z"
          fill="${shade(c.body, -14)}" opacity="0.85"/>
    <g stroke="${c.lace}" stroke-width="11" stroke-linecap="round" fill="none">
      <path d="M486 456 L556 424"/><path d="M516 486 L584 456"/><path d="M548 514 L612 488"/>
    </g>
    <g fill="${shade(c.body, -58)}" opacity="0.75">
      <circle cx="484" cy="458" r="6"/><circle cx="558" cy="422" r="6"/>
      <circle cx="514" cy="488" r="6"/><circle cx="586" cy="454" r="6"/>
      <circle cx="546" cy="516" r="6"/><circle cx="614" cy="486" r="6"/>
    </g>
    <!-- tongue -->
    <path d="M596 364 C616 372 634 384 650 398 L628 420 C614 406 600 396 582 390 Z" fill="${shade(c.body, 34)}"/>
    <!-- sole -->
    <path d="M96 700 C96 678 118 668 150 668 L866 668 C898 668 914 680 914 702 L914 726 L96 726 Z" fill="${c.sole}"/>
    <path d="M96 726 L914 726 L914 744 C914 762 898 772 866 772 L144 772 C112 772 96 762 96 744 Z"
          fill="${shade(c.sole, -34)}"/>
    <path d="M120 700 L890 700" stroke="${shade(c.sole, -20)}" stroke-width="3" opacity="0.55" fill="none"/>
  </g>`;

/** High-top with an ankle collar. */
const hightop = (c) => `
  <g>
    <path d="M110 700 C104 638 150 590 232 556 C316 520 386 484 444 442 C494 406 528 368 548 322
             C562 290 592 274 638 274 C700 274 736 296 744 344 C754 404 762 456 774 492
             C790 540 824 570 866 588 L890 598 L890 700 Z" fill="${c.body}"/>
    <path d="M110 700 C104 638 150 590 232 556 C316 520 386 484 444 442 L468 478
             C402 524 326 562 242 594 C186 616 152 654 148 700 Z" fill="${shade(c.body, -24)}" opacity="0.45"/>
    <path d="M110 700 C104 638 150 590 232 556 L282 624 C220 650 176 670 158 700 Z" fill="${shade(c.body, 20)}"/>
    <!-- ankle collar -->
    <path d="M548 322 C562 290 592 274 638 274 C700 274 736 296 744 344 L716 352
             C708 318 682 304 640 304 C604 304 584 316 576 340 Z" fill="${shade(c.body, 30)}"/>
    <!-- heel panel -->
    <path d="M774 492 C790 540 824 570 866 588 L890 598 L890 700 L806 700 C800 630 786 558 762 500 Z"
          fill="${c.accent}"/>
    <!-- side stripe -->
    <path d="M320 620 C408 600 490 562 560 516 L590 496 L610 548 L578 570
             C506 616 424 652 336 670 Z" fill="${c.accent}" opacity="0.9"/>
    <g stroke="${c.lace}" stroke-width="11" stroke-linecap="round" fill="none">
      <path d="M524 400 L592 378"/><path d="M542 448 L610 428"/>
      <path d="M560 496 L626 478"/><path d="M580 542 L642 526"/>
    </g>
    <g fill="${shade(c.body, -58)}" opacity="0.7">
      <circle cx="522" cy="402" r="6"/><circle cx="594" cy="376" r="6"/>
      <circle cx="540" cy="450" r="6"/><circle cx="612" cy="426" r="6"/>
      <circle cx="558" cy="498" r="6"/><circle cx="628" cy="476" r="6"/>
    </g>
    <path d="M96 700 C96 678 118 668 150 668 L866 668 C898 668 914 680 914 702 L914 726 L96 726 Z" fill="${c.sole}"/>
    <path d="M96 726 L914 726 L914 744 C914 762 898 772 866 772 L144 772 C112 772 96 762 96 744 Z"
          fill="${shade(c.sole, -34)}"/>
  </g>`;

/** Chunky running trainer with a layered midsole. */
const runner = (c) => `
  <g>
    <path d="M108 678 C102 616 150 570 232 538 C318 502 388 468 448 428 C494 398 556 356 614 340
             C652 354 684 380 712 410 C752 390 790 380 822 394 C860 430 886 552 894 678 Z" fill="${c.body}"/>
    <path d="M108 678 C102 616 150 570 232 538 C318 502 388 468 448 428 L474 464
             C406 508 328 546 242 578 C184 600 148 634 144 678 Z" fill="${shade(c.body, -24)}" opacity="0.45"/>
    <path d="M108 678 C102 616 150 570 232 538 L282 606 C218 632 170 650 150 678 Z" fill="${shade(c.body, 20)}"/>
    <path d="M712 410 C752 390 790 380 822 394 C860 430 886 552 894 678 L818 678
             C812 570 792 468 750 420 Z" fill="${c.accent}"/>
    <path d="M300 612 C410 596 520 560 618 508 L646 550 C544 606 428 644 314 662 Z"
          fill="${shade(c.body, 30)}" opacity="0.85"/>
    <path d="M330 592 C440 574 546 538 640 490" stroke="${c.accent}" stroke-width="14" fill="none"
          opacity="0.55" stroke-linecap="round"/>
    <g stroke="${c.lace}" stroke-width="11" stroke-linecap="round" fill="none">
      <path d="M492 444 L560 416"/><path d="M520 476 L588 448"/><path d="M550 506 L616 480"/>
    </g>
    <!-- stacked midsole -->
    <path d="M92 678 C92 652 116 640 150 640 L868 640 C902 640 918 654 918 680 L918 706 L92 706 Z" fill="${c.sole}"/>
    <path d="M92 706 L918 706 L918 730 C918 752 900 764 866 764 L142 764 C110 764 92 752 92 730 Z"
          fill="${shade(c.sole, -18)}"/>
    <path d="M92 748 L918 748 L918 762 C918 778 902 786 870 786 L140 786 C108 786 92 778 92 762 Z"
          fill="${shade(c.sole, -40)}"/>
    <g stroke="${shade(c.sole, -22)}" stroke-width="4" opacity="0.55">
      <path d="M220 668 L220 742"/><path d="M330 664 L330 744"/><path d="M440 662 L440 746"/>
      <path d="M550 662 L550 746"/><path d="M660 664 L660 744"/><path d="M770 668 L770 742"/>
    </g>
  </g>`;

/** Ankle boot with a stacked heel. */
const boot = (c) => `
  <g>
    <path d="M118 700 C112 642 156 596 234 566 C314 534 380 500 436 458 C482 422 512 382 528 332
             C540 294 572 276 622 276 C690 276 726 300 732 352 C742 442 752 530 764 592
             C776 648 800 678 830 692 L856 700 L856 700 Z M856 700 L118 700 Z" fill="${c.body}"/>
    <path d="M528 332 C540 294 572 276 622 276 C690 276 726 300 732 352 L700 360
             C692 322 668 306 624 306 C586 306 564 320 556 348 Z" fill="${shade(c.body, 30)}"/>
    <path d="M118 700 C112 642 156 596 234 566 C314 534 380 500 436 458 L460 494
             C394 540 318 576 244 604 C190 624 158 660 154 700 Z" fill="${shade(c.body, -24)}" opacity="0.4"/>
    <path d="M118 700 C112 642 156 596 234 566 L284 634 C224 658 178 674 158 700 Z" fill="${shade(c.body, 18)}"/>
    <path d="M732 352 C742 442 752 530 764 592 C776 648 800 678 830 692 L856 700 L790 700
             C766 640 748 520 740 400 Z" fill="${c.accent}"/>
    <g stroke="${c.lace}" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.92">
      <path d="M552 384 L630 366"/><path d="M562 440 L640 424"/>
      <path d="M574 496 L650 482"/><path d="M588 552 L660 540"/>
    </g>
    <g fill="${shade(c.body, -52)}" opacity="0.6">
      <circle cx="550" cy="386" r="6"/><circle cx="632" cy="364" r="6"/>
      <circle cx="560" cy="442" r="6"/><circle cx="642" cy="422" r="6"/>
      <circle cx="572" cy="498" r="6"/><circle cx="652" cy="480" r="6"/>
    </g>
    <path d="M104 700 L892 700 L892 730 C892 746 878 754 856 754 L140 754 C116 754 104 746 104 730 Z" fill="${c.sole}"/>
    <path d="M700 754 L892 754 L892 806 C892 822 880 830 860 830 L724 830 C706 830 696 820 696 806 Z"
          fill="${shade(c.sole, -26)}"/>
    <path d="M104 754 L700 754 L700 776 C700 790 688 798 670 798 L138 798 C116 798 104 788 104 774 Z"
          fill="${shade(c.sole, -26)}"/>
  </g>`;

/** Slip-on loafer / dress shoe. */
const loafer = (c) => `
  <g>
    <path d="M114 702 C108 646 154 606 234 578 C318 548 388 516 446 480 C492 452 534 430 572 424
             C618 442 664 462 706 452 C760 440 800 470 830 540 C862 610 884 662 890 702 Z"
          fill="${c.body}"/>
    <path d="M114 702 C108 646 154 606 234 578 C318 548 388 516 446 480 L468 514
             C402 558 328 592 246 618 C190 636 156 668 152 702 Z" fill="${shade(c.body, -26)}" opacity="0.45"/>
    <path d="M114 702 C108 646 154 606 234 578 L280 646 C222 670 174 684 154 702 Z" fill="${shade(c.body, 18)}"/>
    <path d="M706 452 C760 440 800 470 830 540 C862 610 884 662 890 702 L818 702
             C810 630 788 552 748 496 Z"
          fill="${c.accent}"/>
    <!-- saddle strap -->
    <path d="M498 486 C556 508 626 518 692 512 L698 556 C624 562 548 550 482 524 Z" fill="${shade(c.body, 30)}"/>
    <rect x="566" y="506" width="66" height="17" rx="8" fill="${shade(c.accent, -36)}" opacity="0.7"/>
    <!-- opening line -->
    <path d="M470 508 C528 474 586 448 646 440" stroke="${shade(c.body, -46)}" stroke-width="5"
          fill="none" opacity="0.45"/>
    <path d="M94 702 C94 680 116 670 150 670 L868 670 C900 670 916 682 916 704 L916 726 L94 726 Z" fill="${c.sole}"/>
    <path d="M94 726 L916 726 L916 746 C916 764 900 774 868 774 L142 774 C110 774 94 764 94 746 Z"
          fill="${shade(c.sole, -34)}"/>
  </g>`;

/** Open sandal: a contoured footbed with an instep strap and a toe strap. */
const sandal = (c) => `
  <g>
    <!-- instep strap -->
    <path d="M336 560 C404 548 470 560 532 584 C586 604 640 612 690 606 L700 656
             C636 664 572 654 512 632 C456 612 400 602 344 612 Z" fill="${c.body}"/>
    <path d="M336 560 C404 548 470 560 532 584 L512 632 C456 612 400 602 344 612 Z"
          fill="${shade(c.body, -22)}" opacity="0.45"/>
    <!-- toe strap -->
    <path d="M176 648 C224 606 282 580 344 570 L352 620 C302 630 256 652 218 684 Z" fill="${c.accent}"/>
    <!-- heel strap -->
    <path d="M690 606 C742 596 786 604 818 628 L792 668 C768 652 736 648 700 656 Z"
          fill="${shade(c.body, 24)}"/>
    <!-- buckle -->
    <rect x="600" y="600" width="46" height="22" rx="6" fill="${shade(c.accent, -44)}" opacity="0.75"/>
    <!-- footbed -->
    <path d="M150 700 C150 678 172 666 206 666 L856 666 C892 666 910 680 910 702
             L910 716 C910 722 904 726 896 726 L164 726 C156 726 150 722 150 716 Z"
          fill="${c.sole}"/>
    <path d="M206 690 C340 678 520 676 700 682 C780 684 846 690 896 698"
          stroke="${shade(c.sole, -26)}" stroke-width="3" fill="none" opacity="0.7"/>
    <!-- outsole -->
    <path d="M144 726 L916 726 L916 746 C916 760 902 768 878 768 L178 768
             C156 768 144 760 144 746 Z" fill="${shade(c.sole, -38)}"/>
  </g>`;

const SHAPES = { sneaker, hightop, runner, boot, loafer, sandal };

/* -------------------------------------------------------------------------- */
/* Compositions                                                                */
/* -------------------------------------------------------------------------- */

const wrap = (inner, { bg = PAD, id }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" role="img">
  <defs>
    <radialGradient id="pad-${id}" cx="50%" cy="46%" r="62%">
      <stop offset="0%" stop-color="${shade(bg, 10)}"/>
      <stop offset="100%" stop-color="${shade(bg, -10)}"/>
    </radialGradient>
    <radialGradient id="sh-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${SHADOW}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${SHADOW}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#pad-${id})"/>
  ${inner}
</svg>`;

/** Straight side profile — the primary grid image. */
const viewSide = (shape, c, id) =>
  wrap(`<ellipse cx="506" cy="806" rx="368" ry="40" fill="url(#sh-${id})"/>
        <g transform="translate(500 560) scale(1.1) translate(-500 -560) translate(0,-34)">
          ${SHAPES[shape](c)}
        </g>`, { id });

/** Tilted three-quarter view — the second gallery frame. */
const viewAngle = (shape, c, id) =>
  wrap(`<ellipse cx="500" cy="812" rx="336" ry="38" fill="url(#sh-${id})"/>
        <g transform="translate(500 560) rotate(-7) scale(0.99) translate(-500 -560) translate(0,-26)">
          ${SHAPES[shape](c)}
        </g>`, { id });

/** The pair, mirrored and overlapped — the lifestyle frame. */
const viewPair = (shape, c, id) =>
  wrap(`<ellipse cx="500" cy="826" rx="382" ry="38" fill="url(#sh-${id})"/>
        <g opacity="0.5" transform="translate(500 560) scale(0.8) translate(-500 -560) translate(96,-150)">
          ${SHAPES[shape](c)}
        </g>
        <g transform="translate(500 560) scale(0.9) translate(-500 -560) translate(-52,20)">
          ${SHAPES[shape](c)}
        </g>`, { id });

/** Close crop on the upper — the detail frame. */
const viewDetail = (shape, c, id) =>
  wrap(`<g transform="translate(500 560) scale(2) translate(-500 -560) translate(-52,60)">
          ${SHAPES[shape](c)}
        </g>`, { id, bg: PAD_DARK });

const VIEWS = { side: viewSide, angle: viewAngle, pair: viewPair, detail: viewDetail };

/* -------------------------------------------------------------------------- */
/* Colourways                                                                  */
/* -------------------------------------------------------------------------- */

export const COLORWAYS = {
  black:     { name: "مشکی",       hex: "#1A1A1C", body: "#24242A", accent: "#3C3C46", sole: "#141418", lace: "#0E0E12" },
  white:     { name: "سفید",       hex: "#F2F1EE", body: "#F1EFEA", accent: "#DCD7CE", sole: "#FFFFFF", lace: "#E4DED3" },
  cream:     { name: "کرم",        hex: "#E7DCC9", body: "#E9DFCE", accent: "#D2C2A6", sole: "#F6F0E4", lace: "#CDBC9F" },
  burgundy:  { name: "زرشکی",      hex: "#9A1C21", body: "#9A1C21", accent: "#7C1418", sole: "#F1E7DC", lace: "#EEE6DD" },
  navy:      { name: "سرمه‌ای",    hex: "#1F2E4A", body: "#23334F", accent: "#35496B", sole: "#F0EDE7", lace: "#DDE2EA" },
  grey:      { name: "طوسی",       hex: "#7E7B78", body: "#87837F", accent: "#6A6764", sole: "#E4E0DA", lace: "#B8B3AD" },
  tan:       { name: "عسلی",       hex: "#9C6B3E", body: "#A0703F", accent: "#7E5630", sole: "#EDE3D4", lace: "#6E4C2B" },
  olive:     { name: "زیتونی",     hex: "#54603C", body: "#5A6640", accent: "#424C2E", sole: "#E9E5D8", lace: "#3A4328" },
  skyblue:   { name: "آبی روشن",   hex: "#6FA3C9", body: "#7BADD2", accent: "#4A80A8", sole: "#FFFFFF", lace: "#E9F1F7" },
  brown:     { name: "قهوه‌ای",    hex: "#4E3527", body: "#553B2B", accent: "#3D2A1E", sole: "#E8E0D4", lace: "#2F2018" },
  blush:     { name: "صورتی کهنه", hex: "#C99A94", body: "#CEA29B", accent: "#AC7D77", sole: "#FBF6F1", lace: "#B98A84" },
  silver:    { name: "نقره‌ای",    hex: "#B9B7B2", body: "#C2C0BB", accent: "#9C9A95", sole: "#EFEDE8", lace: "#D6D4CF" },
};

/* -------------------------------------------------------------------------- */

let count = 0;
for (const [shapeKey] of Object.entries(SHAPES)) {
  for (const [colorKey, c] of Object.entries(COLORWAYS)) {
    for (const [viewKey, render] of Object.entries(VIEWS)) {
      const id = `${shapeKey}-${colorKey}-${viewKey}`;
      writeFileSync(join(OUT, `${id}.svg`), render(shapeKey, c, id).replace(/\n\s+/g, "\n"), "utf8");
      count++;
    }
  }
}
console.log(`generated ${count} product images in public/products/`);
