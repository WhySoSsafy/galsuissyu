// The rail and the phone's bottom bar were drawing their marks with whatever character came closest
// — ⌕, ⇄, ⌖ and an emoji. An emoji carries its own colour, so 마이 stayed purple on a bar where
// everything else took the text colour, and the weights never matched.
//
// These are one set: 24px box, stroked not filled, currentColor, so a selected item turns white with
// its label and nothing has to be restyled per place.
const base={width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};

export function SearchIcon(){
 // The circle is where the eye puts this glyph's centre, so the ink box sits a touch right of the
 // box centre to make the circle itself land on it.
 return <svg {...base}><circle cx="10.9" cy="10.9" r="6.2"/><path d="M15.4 15.4 19.9 19.9"/></svg>;
}

export function RouteIcon(){
 // Two arrows exchanging, drawn symmetrically about the centre in both axes.
 return <svg {...base}><path d="M4 9h13"/><path d="M14 6l3 3-3 3"/><path d="M20 15H7"/><path d="M10 12l-3 3 3 3"/></svg>;
}

export function MapIcon(){
 return <svg {...base}><path d="M9.2 4.3 3.5 6.6v13.1l5.7-2.3 5.6 2.3 5.7-2.3V4.3l-5.7 2.3z"/><path d="M9.2 4.3v13.1M14.8 6.6v13.1"/></svg>;
}

export function PersonIcon(){
 return <svg {...base}><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8"/></svg>;
}
