// The rail and the phone's bottom bar were drawing their marks with whatever character came closest
// — ⌕, ⇄, ⌖ and an emoji. An emoji carries its own colour, so 마이 stayed purple on a bar where
// everything else took the text colour, and the weights never matched.
//
// These are one set: 24px box, stroked not filled, currentColor, so a selected item turns white with
// its label and nothing has to be restyled per place.
const base={width:22,height:22,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};

export function SearchIcon(){
 return <svg {...base}><circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8 20.5 20.5"/></svg>;
}

export function RouteIcon(){
 return <svg {...base}><path d="M3.5 7.5h10.5a3.5 3.5 0 0 1 0 7H8"/><path d="M11 4.5 14 7.5 11 10.5"/><path d="M6.5 11.5 3.5 14.5 6.5 17.5"/></svg>;
}

export function MapIcon(){
 return <svg {...base}><path d="M9.2 4.3 3.5 6.6v13.1l5.7-2.3 5.6 2.3 5.7-2.3V4.3l-5.7 2.3z"/><path d="M9.2 4.3v13.1M14.8 6.6v13.1"/></svg>;
}

export function PersonIcon(){
 return <svg {...base}><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8"/></svg>;
}
