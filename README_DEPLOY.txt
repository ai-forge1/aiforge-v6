AIFORGE v6 — VERCEL READY v0.2 GEOMETRY FIX

Tato verze opravuje kritickou vazbu:
update_dimension -> globalDimensions + elements[].start/end + lengthMm

Při změně openingWidth:
- pokud protiváha pochází z default_estimate, znovu se spočítá 40 %;
- pokud je protiváha userProvided, zachová se;
- přepočítají se P01-P07 canonical start/end;
- totalLength je vždy odvozená hodnota;
- profily, ceny a financials se zachovají.

Příklad:
4200 / default CW 1680
-> openingWidth 5900
-> default CW 2360
-> totalLength 8260

Referenční výrobní brána:
openingWidth 5900 + counterweightLength 2500
-> totalLength 8400
Protiváhu je potřeba zadat explicitně.

Bezpečnost:
Pokud construction obsahuje další custom geometrické elements[] mimo canonical gate frame,
změna hlavních rozměrů se odmítne, dokud je nebude řešit jejich vlastní geometry modul.

Git/Vercel:
Repozitář je připojený k projektu aiforge-v6. Tento commit slouží jako první automatický Git deployment trigger.
