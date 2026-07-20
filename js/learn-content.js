  /* ============================================================
     LEARN CONTENT — the write-ups, artwork references, and (unused
     for now) quiz data for the Learning tab. Kept as pure data,
     separate from js/learn.js (which renders it) and
     js/api-sources.js (which resolves lookups/portraits into real
     fetched data).

     ref() / refArt() mark up an inline mention of another entry or a
     referenced artwork. js/learn.js turns these into clickable
     elements after the write-up is inserted into the page: clicking
     an artist's name jumps straight to their page, clicking an
     artwork's title scrolls to and highlights that example on the
     right. This replaced an earlier "continue to X" button design —
     following a reference now happens inline, wherever it comes up,
     rather than only at the bottom of a fixed path.

     Quiz arrays are still here but currently unused — js/learn.js
     doesn't render them right now. Left in place for a possible
     later per-topic quiz feature.

     `lookup` shapes (used to fetch the real artwork for an example):
       { type:'id', source:'aic', id:87088 }
       { type:'title', source:'aic', artist:'Claude Monet', titleKeyword:'Bennecourt' }
     ============================================================ */

  function ref(kind, id, label){
    return `<button type="button" class="learn-ref" data-ref-kind="${kind}" data-ref-id="${id}">${label}</button>`;
  }
  function refArt(exampleIndex, label){
    return `<button type="button" class="learn-ref learn-ref-art" data-ref-example="${exampleIndex}">${label}</button>`;
  }

  const LEARN_CONTENT = {

    movements: {
      impressionism: {
        id: 'impressionism',
        kind: 'movement',
        title: 'Impressionism',
        years: '1870s\u20131890s',
        teaser: 'Loose brushwork, everyday scenes, and a group of painters who got tired of doing things properly.',
        writeupHtml: `
          <p>Paris, the 1870s. A cluster of painters had grown tired of painting things the approved way. The official Salon wanted polish: smooth surfaces, historical drama, heroes standing around in togas. A handful of younger painters wanted none of it. Among them were ${ref('artist', 'monet', 'Claude Monet')} and ${ref('artist', 'renoir', 'Pierre-Auguste Renoir')}, who packed up their paints and went outside to chase light before it changed its mind.</p>
          <p>A critic looking at one of Monet's harbor scenes called the whole thing sketchy and unfinished, and used the word "impression" as an insult. The name stuck anyway. Painters have survived worse reviews.</p>
          <p>What actually separates this from what came before? Visible brushwork instead of smoothed-out surfaces. Color built from small dabs sitting next to each other rather than pre-mixed on a palette. Ordinary subjects like train stations and riverbanks instead of gods and generals. And a genuine obsession with one specific moment of light rather than some tidy, idealized version of it.</p>
          <p>You can watch that idea play out quietly in Monet's ${refArt(0, 'Water Lily Pond')} (1900). Stand close and the water never resolves into a clean reflective surface. It stays a scatter of green, violet and white that only agrees to become "water" once you step back. ${ref('artist', 'renoir', 'Renoir')} was working with the same loose technique around the same time, just pointed at people instead of ponds. His ${refArt(1, 'Two Sisters (On the Terrace)')} (1881) shares that same hazy, dissolving background, though the figures themselves stay soft-edged and warm rather than disappearing into it.</p>
        `,
        examples: [
          { lookup: { type:'id', source:'aic', id: 87088 }, refLabel: 'Water Lily Pond' },
          { lookup: { type:'id', source:'aic', id: 14655 }, refLabel: 'Two Sisters (On the Terrace)' }
        ],
        /* ===== RELATED ENTRIES (experimental — see js/learn.js) ===== */
        related: [
          { kind: 'artist', id: 'monet' },
          { kind: 'artist', id: 'renoir' },
          { kind: 'subject', id: 'light' }
        ],
        /* ===== /RELATED ENTRIES ===== */
        quiz: [
          {
            question: 'What did critics originally mean by calling this group "Impressionists"?',
            options: [
              'It was a mocking reference to how sketchy and unfinished the paintings looked',
              "It was a tribute to the artists' shared teacher",
              'It described the exhibition hall where they first showed together',
              'It referred to their technique of pressing paint directly from the tube'
            ],
            correct: 0
          },
          {
            question: 'In Water Lily Pond, is the water rendered with smooth blending or with visible, separate brushstrokes?',
            options: ['Smooth blending', 'Visible, broken brushstrokes'],
            correct: 1
          },
          {
            question: 'True or false: Impressionist painters generally worked from historical or mythological subject matter.',
            options: ['True', 'False'],
            correct: 1
          }
        ]
      },
      romanticism: {
        id: 'romanticism',
        kind: 'movement',
        title: 'Romanticism',
        years: 'early 1800s',
        teaser: 'Storms, wild animals, history\u2019s worst days. Basically one long eye-roll at the Enlightenment.',
        writeupHtml: `
          <p>Romanticism showed up in the early 1800s as basically one long eye-roll at the Enlightenment's obsession with cool logic and orderly composition. The Neoclassical painters right before them wanted everything balanced, restrained, dignified, like a marble statue that never sweats. The Romantics said no thanks, we'd rather feel something, and went looking for subjects that could genuinely rattle a viewer. Storms. Wild animals. History's worst days. Anything that reminded you that nature and fate don't really care about your composure.</p>
          <p>It wasn't one tidy art movement with a manifesto and a group chat. Painters in Paris, London, Madrid and Dresden were all circling the same idea more or less on their own, which is kind of funny when you think about it, like several people independently deciding the same restaurant was overrated. What they landed on was pretty consistent though. Loose, energetic brushwork. Dramatic lighting. A soft spot for chaos over order. And a genuine interest in raw personal emotion as something worth putting front and center on a canvas, not something to be smoothed over with technique.</p>
          <p>${ref('artist', 'delacroix', "Delacroix's")} ${refArt(0, 'Lion Hunt')} (1860) is a good gateway drug into all this. Men, horses and lions are all tangled together in one big violent knot, and the paint itself looks like it's still moving. ${ref('artist', 'turner', 'Turner')} goes at it from a totally different angle in ${refArt(1, 'The Burning of the Houses of Lords and Commons')} (1834), where London's Parliament is on fire and the whole sky has basically dissolved into orange chaos. Different subjects, same instinct. Both painters wanted you to feel a little unsteady looking at it, not admire how tidy everything was.</p>
        `,
        examples: [
          { lookup: { type:'id', source:'aic', id: 81505 }, refLabel: 'Lion Hunt' },
          { lookup: { type:'accession', source:'cleveland', accession: '1942.647' }, refLabel: 'The Burning of the Houses of Lords and Commons' }
        ],
        /* ===== RELATED ENTRIES (experimental — see js/learn.js) ===== */
        related: [
          { kind: 'artist', id: 'delacroix' },
          { kind: 'artist', id: 'turner' },
          { kind: 'subject', id: 'nature-sublime' }
        ],
        /* ===== /RELATED ENTRIES ===== */
        quiz: []
      }
    },

    artists: {
      monet: {
        id: 'monet',
        kind: 'artist',
        title: 'Claude Monet',
        years: '1840\u20131926',
        movementId: 'impressionism',
        portraitQuery: 'Claude Monet',
        teaser: 'Painted the same pond a hundred times because the light never sat still long enough to paint it once.',
        writeupHtml: `
          <p>Claude Monet lived from 1840 to 1926, long enough to watch the style he helped invent go from scandalous to beloved to slightly overexposed on tote bags. He is the artist most people picture when someone says "impressionism," and that reputation is earned. Monet didn't just work in the style. He spent decades pushing it further than almost anyone else was willing to go.</p>
          <p>His obsession was simple to state and impossible to finish. Light does not hold still. A haystack looks different at eight in the morning than it does at noon, and different again by October. So instead of settling on one "true" version of a subject, Monet painted the same one repeatedly, at different hours and seasons, treating the changing light as the actual subject rather than the haystack itself.</p>
          <p>You can watch this develop across his career. In an early piece like ${refArt(0, 'On the Bank of the Seine, Bennecourt')}, painted in 1868, the water and sky are already loosening up, though the brushwork still holds a fair amount of structure. By the time he painted ${refArt(1, 'Water Lily Pond')} in 1900, in his own garden at Giverny, that structure has mostly dissolved. Water, sky and lily pads blur into each other, held together by color rather than outline.</p>
          <p>If you're trying to spot a Monet in a room full of other ${ref('movement', 'impressionism', 'Impressionists')}, look for water and reflected light as recurring obsessions, a habit of painting the same subject in long series, and brushwork that gets looser the later you go in his career. His final Giverny paintings sit right on the edge of pure abstraction, decades before that was supposed to be a thing.</p>
        `,
        examples: [
          { lookup: { type:'title', source:'aic', artist:'Claude Monet', titleKeyword:'Bennecourt' }, refLabel: 'On the Bank of the Seine, Bennecourt' },
          { lookup: { type:'id', source:'aic', id: 87088 }, refLabel: 'Water Lily Pond' }
        ],
        /* ===== RELATED ENTRIES (experimental — see js/learn.js) ===== */
        related: [
          { kind: 'movement', id: 'impressionism' },
          { kind: 'subject', id: 'light' }
        ],
        /* ===== /RELATED ENTRIES ===== */
        quiz: [
          {
            question: 'What real-world problem was Monet obsessively trying to capture across his career?',
            options: [
              'How light changes over time on the same subject',
              'Correct human anatomy and proportion',
              'Precise geometric perspective',
              'How to mix paint so brushstrokes never show'
            ],
            correct: 0
          },
          {
            question: "Comparing Bennecourt (1868) to Water Lily Pond (1900): did Monet's brushwork get tighter or looser over his career?",
            options: ['Tighter', 'Looser'],
            correct: 1
          },
          {
            question: 'Which of these did Monet famously paint over and over as a repeated series?',
            options: ['Haystacks', 'Battle scenes', 'Royal portraits', 'Shipwrecks'],
            correct: 0
          }
        ]
      },
      renoir: {
        id: 'renoir',
        kind: 'artist',
        title: 'Pierre-Auguste Renoir',
        years: '1841\u20131919',
        movementId: 'impressionism',
        portraitQuery: 'Pierre-Auguste Renoir',
        teaser: 'Took the same loose technique as Monet and pointed it at people instead of ponds.',
        writeupHtml: `
          <p>Renoir lived from 1841 to 1919 and trained alongside ${ref('artist', 'monet', 'Monet')} early in both their careers, the two of them painting side by side and pushing each other toward the loose, light-chasing style that became ${ref('movement', 'impressionism', 'Impressionism')}. But where Monet gravitated toward water and landscape, Renoir's lasting subject was people. Dances, boating parties, portraits of friends, all rendered with a warm, sun-soaked softness that's fairly easy to recognize once you've seen a few.</p>
          <p>${refArt(0, 'Two Sisters (On the Terrace)')} (1881) is a good example of exactly this. It was painted at Chatou, a riverside town outside Paris that Renoir apparently considered the most pleasant of all the Paris suburbs, and shows two young women on a terrace overlooking the Seine. They were not actually sisters. The models were unrelated, which is the kind of detail that makes a title feel like a small act of branding.</p>
          <p>Look at how the background dissolves into soft, unfocused color while the two figures stay comparatively solid. Renoir was happy to let a landscape blur into near abstraction, but rarely did the same to a human face. The palette leans warm throughout, pink skin, warm blues, golden light, giving the whole scene a glow that feels distinct from Monet's cooler and more analytical relationship with color.</p>
          <p>To tell a Renoir from a Monet at a glance: people take center stage rather than sitting in as an afterthought, the palette runs warmer and rosier, and the figures hold their shape even as everything around them softens into brushwork.</p>
        `,
        examples: [
          { lookup: { type:'id', source:'aic', id: 14655 }, refLabel: 'Two Sisters (On the Terrace)' }
        ],
        /* ===== RELATED ENTRIES (experimental — see js/learn.js) ===== */
        related: [
          { kind: 'movement', id: 'impressionism' }
        ],
        /* ===== /RELATED ENTRIES ===== */
        quiz: [
          {
            question: "What was Renoir's more consistent subject matter compared to Monet's?",
            options: ['People and social scenes', 'Water and reflections', 'Mountain landscapes', 'Still life arrangements'],
            correct: 0
          },
          {
            question: 'In Two Sisters, does Renoir keep the figures or the background more solidly defined?',
            options: ['The figures', 'The background'],
            correct: 0
          },
          {
            question: 'True or false: the two women in Two Sisters (On the Terrace) were Renoir\u2019s actual sisters.',
            options: ['True', 'False'],
            correct: 1
          }
        ]
      },
      delacroix: {
        id: 'delacroix',
        kind: 'artist',
        title: 'Eug\u00e8ne Delacroix',
        years: '1798\u20131863',
        movementId: 'romanticism',
        portraitQuery: 'Eug\u00e8ne Delacroix',
        teaser: 'The mascot of French Romanticism. Built figures out of color pushing against color instead of outline.',
        writeupHtml: `
          <p>Delacroix (1798\u20131863) is basically the mascot of French ${ref('movement', 'romanticism', 'Romanticism')}. Renoir, Van Gogh and even Picasso all name-checked him later as someone who cracked something open. His whole deal was color and motion doing the work that outline and stillness used to do. An academic painter builds a figure like they're coloring inside careful lines. Delacroix just about ignores the lines and builds the figure out of color pushing against color, so the paint itself feels like it's got a pulse.</p>
          <p>He also had a taste for subjects with built-in drama. Combat, animals mid-fight, anything exotic or unfamiliar (a trip to North Africa in 1832 gave him a lifetime supply of imagery he kept returning to). ${refArt(0, 'The Natchez')} (1834\u201335) shows this pull toward heightened, emotionally loaded scenes even when there's no actual battle happening. ${refArt(1, 'Lion Hunt')} is the louder version, all motion and teeth and nobody in the frame having a calm day.</p>
          <p>Here's the cheat sheet, the stuff that basically screams "this is a Delacroix" the second you see it: more than one figure, and they're all doing something to each other, not just standing there. Color that looks hot and turned up, not realistic, almost like the painting has a temperature. Brushwork you can actually see moving, like the paint hasn't quite settled yet. And a general vibe of conflict, tension, or somewhere far from home. If the painting looks calm and orderly, it's probably not him.</p>
        `,
        examples: [
          { lookup: { type:'id', source:'met', id: 436180 }, refLabel: 'The Natchez' },
          { lookup: { type:'id', source:'aic', id: 81505 }, refLabel: 'Lion Hunt' }
        ],
        /* ===== RELATED ENTRIES (experimental — see js/learn.js) ===== */
        related: [
          { kind: 'movement', id: 'romanticism' },
          { kind: 'subject', id: 'nature-sublime' }
        ],
        /* ===== /RELATED ENTRIES ===== */
        quiz: []
      },
      turner: {
        id: 'turner',
        kind: 'artist',
        title: 'J.M.W. Turner',
        years: '1775\u20131851',
        movementId: 'romanticism',
        portraitQuery: 'J. M. W. Turner',
        teaser: 'Built drama out of weather instead of people. Let the sky and sea eat the rest of the painting alive.',
        writeupHtml: `
          <p>Turner (1775\u20131851) took ${ref('movement', 'romanticism', 'Romanticism')} somewhere ${ref('artist', 'delacroix', 'Delacroix')} never really went. Instead of building drama out of people or animals doing violent things to each other, Turner built it out of weather. Sky, water, smoke, fire, whatever the atmosphere was doing that day, and he'd push it until it basically ate the rest of the painting alive.</p>
          <p>${refArt(0, 'The Burning of the Houses of Lords and Commons')} is a great example because it's technically a real historical event, London's Parliament actually burned down in 1834, but Turner cranks the flames up so high and blurs the smoke so thoroughly that the people watching from the riverbank end up looking like an afterthought. Same thing happens in ${refArt(1, 'Whalers')} (c. 1845), where a wounded whale thrashing in a sea of foam and blood practically dissolves the whole composition into churn. Turner kept pushing this direction his whole career, to the point where his late paintings barely have a subject left, just color and light doing something turbulent, which later painters, including eventually the Impressionists, took real notice of.</p>
          <p>The Turner tell, if you're trying to clock one fast: the sky and water are basically fighting for who gets to be the main character. Everything solid, boats, buildings, people, looks like it's about thirty seconds from dissolving into fog or fire. It's hazy in a way that feels deliberate, not like bad restoration. And if you squint and can't quite tell where the sea ends and the sky begins, that's not your eyesight, that's just Turner.</p>
        `,
        examples: [
          { lookup: { type:'accession', source:'cleveland', accession: '1942.647' }, refLabel: 'The Burning of the Houses of Lords and Commons' },
          { lookup: { type:'id', source:'met', id: 437854 }, refLabel: 'Whalers' }
        ],
        /* ===== RELATED ENTRIES (experimental — see js/learn.js) ===== */
        related: [
          { kind: 'movement', id: 'romanticism' },
          { kind: 'subject', id: 'nature-sublime' }
        ],
        /* ===== /RELATED ENTRIES ===== */
        quiz: []
      }
    },

    subjects: {
      light: {
        id: 'light',
        kind: 'subject',
        title: 'Light',
        movementIds: ['impressionism'],
        teaser: 'Two painters, three centuries apart, with almost opposite theories about what light is even for.',
        writeupHtml: `
          <p>Every era of painting has had to answer the same basic question. What do you actually do with light? Compare two extremes and the differences become obvious fast.</p>
          <p>Take Rembrandt's approach in ${refArt(0, 'Old Man with a Gold Chain')}, a textbook example of Baroque light from about a century before Impressionism existed. A single strong source, often unseen and only implied, rakes across the subject and throws everything else into near total darkness. It's theatrical and deliberately selective. Light exists to sculpt form, build mood and drag your eye toward exactly one thing, usually a face. The background barely gets to exist. It's swallowed in shadow on purpose.</p>
          <p>Now put that next to Monet's ${refArt(1, 'Water Lily Pond')}, or better yet his haystack series. Impressionist light works almost in reverse. Instead of one dramatic beam carving darkness out of a scene, light is everywhere at once, diffuse and constantly shifting, and the whole point is that there's no single correct lighting moment, only an endless series of temporary ones. Shadows in an Impressionist painting aren't flat black voids. They're colored, often blue or violet, because ${ref('artist', 'monet', 'Monet')} and his peers had noticed that shadows pick up reflected color from whatever surrounds them rather than being a simple absence of light. Where Baroque light isolates a subject from its environment, Impressionist light dissolves the subject into it.</p>
          <p>The two approaches sit less than three centuries apart and represent almost opposite theories about what light is for in a painting. One reveals through contrast. The other treats light as the entire point.</p>
        `,
        examples: [
          { lookup: { type:'title', source:'aic', artist:'Rembrandt van Rijn', titleKeyword:'Gold Chain' }, refLabel: 'Old Man with a Gold Chain' },
          { lookup: { type:'id', source:'aic', id: 87088 }, refLabel: 'Water Lily Pond' }
        ],
        /* ===== RELATED ENTRIES (experimental — see js/learn.js) ===== */
        related: [
          { kind: 'movement', id: 'impressionism' },
          { kind: 'artist', id: 'monet' },
          { kind: 'subject', id: 'nature-sublime' }
        ],
        /* ===== /RELATED ENTRIES ===== */
        quiz: [
          {
            question: 'In Baroque painting, is light typically diffuse across the whole scene or concentrated on one subject?',
            options: ['Diffuse across the whole scene', 'Concentrated on one subject'],
            correct: 1
          },
          {
            question: 'What did Impressionist painters realize about shadows that changed how they painted them?',
            options: [
              'Shadows contain reflected color, not just black or gray',
              'Shadows should be avoided entirely',
              'Shadows only appear at sunset',
              'Shadows are always the same size as the object'
            ],
            correct: 0
          },
          {
            question: 'Which approach treats light itself as the main subject of the painting: Baroque or Impressionism?',
            options: ['Baroque', 'Impressionism'],
            correct: 1
          }
        ]
      },
      'nature-sublime': {
        id: 'nature-sublime',
        kind: 'subject',
        title: 'Nature & the Sublime',
        movementIds: ['romanticism'],
        teaser: 'Not pretty nature. The kind that could kill you, watched from just far enough away to be safe.',
        writeupHtml: `
          <p>${ref('movement', 'romanticism', 'Romantic')} painters loved nature, but not the pretty postcard version. They were after something a little more specific, that feeling of standing in front of something enormous and powerful that genuinely does not care whether you live or die. There's actually a real word for that exact feeling, the sublime, and it's worth knowing because it's more precise than just saying "nature." A calm meadow is beautiful. A storm that could kill you, watched from just far enough away to be safe, is sublime. Same general subject, very different feeling in your chest.</p>
          <p>${ref('artist', 'turner', "Turner's")} ${refArt(0, 'The Burning of the Houses of Lords and Commons')} goes for the sublime through sheer scale and disaster. ${ref('artist', 'delacroix', "Delacroix's")} ${refArt(1, 'Lion Hunt')} goes for it through raw physical violence, nature as predator rather than weather. And then there's a quieter version of the same idea in Caspar David Friedrich's ${refArt(2, 'After the Storm')} (1817), which shows a ship that's just survived rough seas, with dramatic clouds still breaking apart overhead. No fire, no fangs, just a small boat and a massive, indifferent sky, which honestly might be the most sublime option of the three since nothing's even actively trying to kill anyone anymore. The danger already happened. You're just sitting with how small that made everyone feel.</p>
          <p>Worth comparing this to ${ref('subject', 'light', 'Impressionist light')} too, since on the surface both are about nature. ${ref('artist', 'monet', "Monet's")} ${refArt(3, 'Water Lily Pond')} wants you to lean in close and admire how color behaves up close, a quiet, intimate kind of looking. The sublime wants the opposite. It wants distance. It wants you to feel how little control you actually have. Same general territory, nature and light, aimed at two pretty different feelings.</p>
        `,
        examples: [
          { lookup: { type:'accession', source:'cleveland', accession: '1942.647' }, refLabel: 'The Burning of the Houses of Lords and Commons' },
          { lookup: { type:'id', source:'aic', id: 81505 }, refLabel: 'Lion Hunt' },
          { lookup: { type:'inventory', source:'smk', inventory: 'KMS8817' }, refLabel: 'After the Storm' },
          { lookup: { type:'id', source:'aic', id: 87088 }, refLabel: 'Water Lily Pond' }
        ],
        /* ===== RELATED ENTRIES (experimental — see js/learn.js) ===== */
        related: [
          { kind: 'movement', id: 'romanticism' },
          { kind: 'artist', id: 'turner' },
          { kind: 'artist', id: 'delacroix' },
          { kind: 'subject', id: 'light' }
        ],
        /* ===== /RELATED ENTRIES ===== */
        quiz: []
      }
    },

    mediums: {}
  };
