# NOVA — Plateforme IoT \& Energy Harvesting (Partie Hardware)

**Partie matérielle** du projet NOVA : un démonstrateur IoT qui mesure en temps réel :

- l’**énergie récupérée** par des capteurs piézoélectriques (via un supercondensateur),
- l’**énergie consommée** par une LED alimentée sur batterie,
- l’**état du système** (LED allumée/éteinte, statut global),

et envoie ces données au backend NOVA pour visualisation dans le **Dashboard IoT**.

L’objectif n’est pas d’alimenter réellement la LED uniquement par les piézos (ce n’est pas physiquement réaliste), mais de **montrer et mesurer** le déséquilibre entre énergie produite et consommée, comme base de réflexion Smart City.

***

## Stack matérielle

| Bloc | Composant / Module |
| :-- | :-- |
| Microcontrôleurs | 2× ESP32 DevKitC |
| Energy harvesting | LTC3588‑1 Energy Harvester + 1–2 capteurs piézo 35 mm |
| Stockage piézo | Supercondensateur 10 F / 3 V |
| Alimentation LED | Batterie Li‑ion 3,7 V + chargeur TP4056 USB‑C |
| Mesure de courant | Capteur de courant ACS712 VMA323 (±20 A) |
| Commande LED | MOSFET logique IRLZ34N + LED (R/V/J) |
| Conversion DC/DC | Step‑up MT3608 (3,7 V → 5 V pour ACS712)|
| Divers | Breadboards, résistances (330 Ω, 10 kΩ, 100 kΩ), câbles Dupont |


***

## Architecture matérielle

```text
                        ┌─────────────────────────────┐
                        │        ESP32 #2 (Gateway)   │
                        │  - Réception ESP-NOW        │
                        │  - HTTP POST → /api/telemetry
                        └───────────▲─────────────────┘
                                    │ ESP-NOW
                                    │
                        ┌───────────┴─────────────────┐
                        │       ESP32 #1 (Node IoT)   │
                        │  - Cmd LED (GPIO25 → MOSFET)
                        │  - Mesure I_led (ACS712)    │
                        │  - Mesure V_supercap (ADC)  │
                        │  - Calcul énergie & statut  │
                        └───────────▲─────────────────┘
                                    │
                ┌───────────────────┼─────────────────────────┐
                │                   │                         │
      ENERGY HARVESTING       CONSOMMATION LED          ALIM / CHARGE
 ┌─────────────────────┐  ┌────────────────────┐   ┌─────────────────────┐
 │ 1–2× Piézo 35mm     │  │ Batterie 3,7V      │   │ TP4056 USB‑C        │
 │  → LTC3588‑1        │  │  → ACS712 → LED    │   │  + protection       │
 │  → Supercap 10F     │  │  ← MOSFET IRLZ34N  │   │  (charge batterie)  │
 └─────────────────────┘  └────────────────────┘   └─────────────────────┘
```

- Les **piézos** alimentent un **LTC3588‑1** qui régule et stocke l’énergie dans un **supercondensateur 10 F** ; l’ESP32 mesure la tension du supercondo (V_supercap), ce qui permet de calculer l’énergie récupérée $\frac{1}{2}CV^2$.
- La **LED** est alimentée par une **batterie Li‑ion 3,7 V**, chargée via **TP4056** (USB‑C).
- Un **ACS712 20 A** placé en série sur le + batterie mesure le courant réellement consommé par la LED (I_led).
- L’ESP32 \#1 envoie périodiquement ces mesures à l’ESP32 \#2 via **ESP‑NOW**, qui relaie ensuite vers le backend NOVA (HTTP POST `/api/telemetry`).

***

## Fonctionnalités matérielles

### 1. Mesure de la consommation énergie (LED)

- **Commande LED** :
    - ESP32 \#1 → GPIO25 → IRLZ34N (MOSFET canal N logique).
    - La LED (avec résistance série 330 Ω) est entre **OUT+ du TP4056** et le **drain** du MOSFET ; la source est reliée à GND.
    - Pull‑down 10 kΩ sur la gate pour garantir LED OFF par défaut.
- **Mesure du courant** :
    - ACS712 VMA323 (±20 A, 100 mV/A) alimenté en 5 V, sortie analogique vers une entrée ADC de l’ESP32 \#1.
    - Le + batterie (TP4056 OUT+) traverse ACS712 (IP+ → IP−) avant d’aller vers la LED, pour que toute la consommation LED soit mesurée.
- **Calibration** :
    - Offset de sortie mesuré à 0 A (LED OFF) ≈ Vcc/2 ≈ 2,5 V sous 5 V.
    - Courant calculé à partir de la différence ON/OFF (Ion − Ioff) puis **calibré** par rapport à un multimètre (facteur ≈ 0,23 pour que la valeur corresponde aux ~7–12 mA mesurés en réel).
    - L’objectif est une valeur **cohérente et stable**, pas une métrologie industrielle.


### 2. Démonstration d’energy harvesting (piézo + supercondo)

- **LTC3588‑1 Energy Harvester** : breakout Sparkfun‑like avec pins `PZ1`, `PZ2`, `VCC`, `D0`, `D1`, `EN`, `GND`.
- **Entrée piézo** :
    - 1 ou 2 disques piézo 35 mm câblés en parallèle : fils « + » → PZ1, fils « − » → PZ2.
    - Les chocs mécaniques génèrent une tension AC élevée mais un courant très faible ; le LTC3588 rectifie et accumule cette énergie sur un buffer interne, puis délivre des bursts de courant vers VCC.
- **Configuration sortie** :
    - D0 relié à VCC, D1 à GND → sortie **2,5 V** (adaptée à un supercondo 3 V max).
    - EN relié à VCC pour activer le régulateur en continu.
- **Stockage** :
    - Supercondensateur 10 F / 3 V entre VCC et GND.
    - L’énergie stockée est $E = \frac{1}{2} C V^2$, soit jusqu’à ≈ 31 J à 2,5 V.
- **Mesure par ESP32** :
    - VCC → entrée ADC (GPIO 36) via résistance série (≈100 kΩ) pour protéger l’entrée.
    - L’ESP32 calcule :
        - `supercap_voltage` (V)
        - `supercap_energy_j` (J)
    - Ces valeurs sont incluses dans le JSON envoyé au backend (champ `supercap`).


### 3. Choix techniques \& limites physiques

- **Pourquoi la LED n’est PAS alimentée par les piézos ?**
    - Des études expérimentales sur des dalles piézo montrent que l’énergie par impact est de l’ordre de quelques microjoules à millijoules par pas.
    - Une batterie Li‑ion typique stocke plusieurs kilojoules ; charger complètement une telle batterie avec 1–2 piézos prendrait des jours ou des semaines.
    - Les limites du LTC3588 lui‑même (courant max ≈ 100 mA en burst) et du TP4056 (nécessite 4,5–5,5 V et plusieurs centaines de mA pour charger efficacement) rendent irréaliste la charge complète de la batterie dans ce contexte.
- **Position assumée du projet** :
    - Les piézos servent de **preuve de concept** et d’outil pédagogique : *"Voilà l’énergie que nous savons récolter"*.
    - La LED est alimentée par une **batterie chargée en USB‑C** via TP4056 (scénario réaliste pour des dispositifs urbains).
    - Le dashboard compare **énergie produite vs énergie consommée**, et ouvre la discussion sur le dimensionnement nécessaire pour qu’un jour la génération couvre la consommation (ex : dalles piézo industrielles beaucoup plus larges).

***

## Câblage par sous‑modules

### 1. Alimentation \& LED (batterie + TP4056 + IRLZ34N)

```text
Batterie +  ──────→ B+  (TP4056)
Batterie −  ──────→ B−  (TP4056)

TP4056 OUT+ ──────→ ACS712 IP+
TP4056 OUT− ──────→ GND commun

ACS712 IP− ───────→ [330 Ω] → LED Anode
LED Cathode ───────→ IRLZ34N Drain
IRLZ34N Source ────→ GND
IRLZ34N Gate ──────→ GPIO25 ESP32 #1 + résistance 10 kΩ vers GND
```


### 2. ACS712 (mesure de courant)

```text
ACS712 VCC ───────→ 5 V (ESP32 VIN / 5V USB via MT3608 si besoin)
ACS712 GND ───────→ GND commun
ACS712 OUT ───────→ GPIO34 ESP32 #1 (ADC)
```


### 3. Energy harvesting (LTC3588 + piézo + supercondo)

```text
Piézo + ─────────→ PZ1 (LTC3588)
Piézo − ─────────→ PZ2 (LTC3588)

D1 ──────────────→ GND
D0 ──────────────→ VCC
EN ──────────────→ VCC
GND (module) ────→ GND commun

Supercap + ──────→ VCC
Supercap − ──────→ GND

VCC ──[100 kΩ]───→ GPIO36 ESP32 #1 (ADC)
```


### 4. Liaison ESP32 ↔ Backend

- **ESP32 \#1** :
    - lit `current_led_ma` + `supercap_voltage` + `supercap_energy_j` + `system_status`
    - envoie un JSON compact en ESP‑NOW vers ESP32 \#2
- **ESP32 \#2** :
    - reçoit le JSON
    - le forward en HTTP POST vers `/api/telemetry` avec le format attendu par le backend (voir README logiciel).

***

## Télémetrie envoyée (rappel)

Format JSON typique envoyé par ESP32 \#2 :

```json
{
  "device": {
    "id": "esp32-harvester-1",
    "firmware": "1.0.0"
  },
  "timestamp_ms": 1740393600000,
  "supercap": {
    "voltage": 1.85,
    "energy_j": 0.017
  },
  "battery": {
    "current_led_ma": 18.5
  },
  "system": {
    "led_on": true,
    "status": "OK"
  }
}
```

Ces données sont stockées dans la base `nova_telemetry` puis affichées sur le **Dashboard IoT** du frontend (graphiques temps réel de la tension supercap, du courant LED, et de l’état du système).

***

## Procédure de mise en route (résumé rapide)

1. **Monter le circuit Phase 1** : TP4056 + batterie + MOSFET + LED, vérifier que la LED clignote via l’ESP32.
2. **Insérer l’ACS712** sur le + batterie, calibrer l’offset et la mesure (comparaison avec multimètre).
3. **Monter le module LTC3588 + piézo + supercap**, vérifier que V_supercap monte au multimètre et dans le Serial Monitor lorsqu’on tape sur le piézo.
4. **Activer l’ESP‑NOW** entre ESP32 \#1 et \#2, puis le POST HTTP vers `/api/telemetry`.
5. **Démarrer le backend NOVA + frontend** et vérifier que le Dashboard IoT affiche bien les données en temps réel.

***

## Limites et perspectives

- La démo montre clairement que **la LED consomme beaucoup plus d’énergie** que ce que fournissent les 1–2 piézos, même si l’on voit bien l’augmentation de V_supercap à chaque impact.
- Pour rendre le système **énergétiquement autonome**, il faudrait :
    - soit beaucoup plus de surface piézo (dalles de sol, modules industriels),
    - soit combiner plusieurs sources (solaire, éolien urbain, etc.).

Le prototype actuel se concentre donc sur la **mesure**, la **visualisation** et la **compréhension** des ordres de grandeur, en cohérence avec l’objectif pédagogique du projet ESIEA.

***

## Équipe

Projet ESIEA — Groupe 406
Module NOVA — Partie hardware / IoT.