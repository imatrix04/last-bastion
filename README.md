# Last Bastion

Base-defense 2D en coop local (solo ou 2 joueurs sur le même clavier), fait avec **Electron + React + TypeScript**.
Une forteresse au centre de la carte, des vagues de monstres qui arrivent par les bords : barricadez, bâtissez des tourelles et tenez le plus longtemps possible.

## Lancer le jeu

```bash
npm install
npm run dev        # développement (hot reload)
npm run build      # compile main / preload / renderer dans out/
npm run start      # lance le build de production
```

Autres scripts :

```bash
npm run typecheck  # vérification TypeScript (main, preload, renderer, scripts)
npm run sim        # simulation sans interface : 6 scénarios (solo/duo, avec ou sans défenses, labyrinthes aléatoires)
```

## Jouer en ligne (chacun sur son PC)

Dans le menu : un joueur clique sur **Héberger une partie** (il est le Joueur 1, bleu) et donne son adresse à l'autre, qui la saisit puis clique sur **Rejoindre** (Joueur 2, rose). En ligne, chacun joue avec les touches du Joueur 1 (ZQSD / WASD, Espace, F, A/E…).

- Même réseau (même box ou Wi-Fi) : l'adresse affichée dans la salle d'attente suffit (port 7777).
- À distance : soit redirection du port TCP 7777 de la box de l'hôte vers son PC, soit un VPN privé (Tailscale, ZeroTier, Radmin VPN) et on utilise l'adresse du VPN.
- Windows demande d'autoriser le jeu dans le pare-feu la première fois que l'on héberge : accepter (réseaux privés).
- L'hôte fait tourner toute la simulation et envoie l'état 20 fois par seconde ; l'invité envoie ses touches. Si l'invité se déconnecte, la partie continue et il peut se reconnecter. Seul l'hôte peut relancer une partie après un game over.

## Commandes

Les touches sont liées à leur **position** sur le clavier : ZQSD sur AZERTY = WASD sur QWERTY. Les labels affichés dans le jeu s'adaptent à ta disposition.

| Action                       | Joueur 1 | Joueur 2                   |
| ---------------------------- | -------- | -------------------------- |
| Se déplacer                  | W A S D  | Flèches                    |
| Construire / réparer         | Espace   | Entrée                     |
| Démolir (remboursement 50 %) | F        | Maj droite                 |
| Objet précédent / suivant    | Q / E    | `,` / `.` (touches voisines de M) |
| Choix direct de l'objet      | 1 – 4    | Pavé numérique 1 – 4       |

Global : **N** lance la vague suivante plus tôt (bonus d'or), **Échap** ou **P** met en pause, **F11** plein écran.

Les joueurs **tirent automatiquement** sur l'ennemi le plus proche et construisent sur **la case juste devant eux** (le fantôme coloré montre la cible : vert = OK, bleu = réparation, orange = pas assez d'or, rouge = impossible).

## Règles du jeu

- L'or est partagé. Il vient des monstres abattus et de la fin de chaque vague.
- **Barricade** (10) : bois, fragile, pas cher. **Mur de pierre** (30) : 420 PV. **Tourelle** (90) : tire seule, portée 240 px. **Pieux** (25) : piège au sol qui blesse et ralentit, s'use à chaque passage.
- Les ennemis cherchent le chemin le moins coûteux vers la forteresse : ils **contournent** si c'est moins cher, sinon ils **cassent** le point le plus faible. Un labyrinthe bien pensé les fait marcher longtemps sous le feu des tourelles.
- Les bords de la carte restent libres (couloirs d'apparition, signalés par des chevrons rouges avant chaque vague). De plus en plus de côtés s'ouvrent au fil des vagues.
- Ennemis : Rôdeur, Coureur (rapide), Brute (costaud), Colosse (boss toutes les 5 vagues). À deux, les vagues sont 1,6 fois plus nombreuses.
- Le meilleur score (vague atteinte) est sauvegardé en local.

## Architecture

```
src/
  main/index.ts               fenêtre Electron, plein écran, quitter
  main/net.ts                 serveur / client WebSocket (jeu en ligne), exposé par IPC
  preload/index.ts            API minimale exposée au renderer (contextBridge)
  renderer/src/
    App.tsx, store.ts         écrans (menu / jeu / pause / game over), état zustand
    components/               Menu, Hud, Overlays, GameCanvas
    game/                     le jeu lui-même, sans dépendance à React
      constants.ts            équilibrage : bâtiments, ennemis, vitesses, coûts
      update.ts               simulation (joueurs, vagues, ennemis, tourelles, tirs)
      pathing.ts              champ de distance vers la forteresse (les murs ont un coût)
      build.ts                construire / réparer / démolir
      waves.ts                composition des vagues et points d'apparition
      render.ts               rendu canvas
      engine.ts               boucle de jeu à pas fixe 60 Hz, pont vers le HUD React (modes local / hôte / client)
      netproto.ts             messages réseau : entrées, snapshots, validation
      remoteInput.ts          touches du joueur distant vues comme celles du joueur 2
      clientView.ts           côté invité : affichage de l'état reçu + prédiction de son déplacement
scripts/simulate.ts           simulation headless pour valider la logique
```

React ne gère que les menus et le HUD (mis à jour ~10 fois par seconde). Le jeu vit dans un état mutable hors de React, avec une simulation à pas fixe et un rendu canvas, ce qui évite tout re-render à 60 fps.

## Équilibrage

Tout se règle dans `src/renderer/src/game/constants.ts` (coûts, PV, dégâts, vitesses) et `waves.ts` (taille des vagues). `npm run sim` donne un aperçu rapide de l'effet d'un changement.

## Idées pour la suite

- Ennemis qui s'en prennent aux joueurs (PV, mort, réanimation par l'autre joueur)
- Manette (Gamepad API) pour le joueur 2
- Sons et musique, meilleurs sprites
- Améliorations de tourelles, nouveaux bâtiments (mine d'or, mur piégé), ennemis à distance
- Sauvegarde de partie via le process principal, packaging (electron-builder) pour Steam / itch.io
- Multijoueur en ligne (le moteur est déjà séparé du rendu, ce qui aide)
