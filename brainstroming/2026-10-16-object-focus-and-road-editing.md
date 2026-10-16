# Object par zoom aur road editing ka asar

Date: 2026-10-16

## Implemented

Design Objects mein kisi object par click karen to map us par zoom karta hai. Selected 2D, 3D, Street ya Cinematic view type rehti hai. Zoom object ke size ke mutabiq hota hai. Street view mein camera object se thora pehle eye height par aata hai.

## Rearrange kaise karen?

- Object select karen, Move tool se drag karen ya nayi jagah click karen.
- Road select karen. Blue points ko drag karne se road ka route stretch hota hai.
- Building ke blue corner handles se dimensions adjust hoti hain.
- Inspector mein exact size/coordinates edit kar sakte hain.
- Undo se pichli change wapas kar sakte hain.

Shared road node badalne par us node se connected roads bhi adjust hoti hain. Buildings khud saath move nahi hotin. Road access aur overlaps ki live checks badal sakti hain. Har nazar aata crossing shared node nahi hota.

## Pending idea

Har individual object ka separate Lock/Unlock abhi nahi hai. Is ko add karna alag task hoga, taa ke locked object move, resize ya delete na ho aur shared road node editing mein bhi us ka lock respect ho.
