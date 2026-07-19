  /* ============================================================
     LEARN CONTENT — the actual write-ups, artwork references, and
     quizzes for the Learning tab. Kept as pure data, separate from
     js/learn.js (which renders it) and js/api-sources.js (which adds
     the fetch helpers used to resolve `lookup` into a real artwork).

     Every entry can be reached two ways: browsed directly from its
     own tab (Movements / Artists / Subjects / Mediums), or walked in
     sequence via a movement's `path` — the guided order of artists
     and subjects that movement leads into.

     `lookup` shapes:
       { type:'id', source:'aic', id:87088 }
       { type:'title', source:'aic', artist:'Claude Monet', titleKeyword:'Bennecourt' }
     ============================================================ */

  const LEARN_CONTENT = {

    movements: {
      impressionism: {
        id: 'impressionism',
        kind: 'movement',
        title: 'Impressionism',
        years: '1870s–1890s',
        teaser: 'Loose brushwork, everyday scenes, and a fixation on how light actually looks in a fleeting moment.',
        writeupHtml: `
          <p>Impressionism began in Paris in the 1870s as a rebellion against the polished, studio-bound painting the French art establishment demanded. A group of painters — Monet, Renoir, Degas, Pissarro, Morisot among them — started working outdoors, painting quickly, and caring more about how light and color hit the eye in a fleeting moment than about smooth, "finished" detail. Critics meant it as an insult when they borrowed the title of Monet's <em>Impression, Sunrise</em> to mock the group as sketchy and unfinished — the name stuck, and the painters kept it.</p>
          <p>A few things define the look: visible, broken brushstrokes instead of smoothed-out surfaces; color built up from small dabs placed next to each other rather than pre-mixed on the palette; everyday, unposed subject matter — train stations, riverbanks, dance halls, laundry — instead of history and mythology; and an obsession with capturing a <em>specific</em> moment of light, rather than an idealized, timeless one.</p>
          <p>You can see all of this directly in Monet's <strong>Water Lily Pond</strong> (1900) — the water isn't rendered as a smooth reflective surface the way an academic painter would have done it; it's built from loose, overlapping strokes of green, violet, and white that only resolve into "water" from a few feet back. Compare that to Renoir's <strong>Two Sisters (On the Terrace)</strong> (1881): same era, same loose brushwork, but Renoir points the technique at people rather than landscape — warm, soft-edged figures against a hazy, dissolving background, prioritizing atmosphere over sharp detail even in a portrait setting.</p>
        `,
        examples: [
          { lookup: { type:'id', source:'aic', id: 87088 }, refLabel: 'Water Lily Pond' },
          { lookup: { type:'id', source:'aic', id: 14655 }, refLabel: 'Two Sisters (On the Terrace)' }
        ],
        quiz: [
          {
            question: "What did critics originally mean by calling this group \u201cImpressionists\u201d?",
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
        ],
        path: [
          { kind: 'artist', id: 'monet' },
          { kind: 'artist', id: 'renoir' },
          { kind: 'subject', id: 'light' }
        ]
      }
    },

    artists: {
      monet: {
        id: 'monet',
        kind: 'artist',
        title: 'Claude Monet',
        years: '1840–1926',
        movementId: 'impressionism',
        teaser: "Obsessed with how light changes — painted the same subject over and over to catch it.",
        writeupHtml: `
          <p>Claude Monet (1840–1926) is the artist most people picture when they hear "Impressionism," and for good reason — he didn't just work in the style, he spent his career pushing it further than almost anyone else. Monet was fixated on one specific problem: light doesn't hold still. The color of a haystack, a cathedral, a pond changes completely depending on the hour, the season, the weather — so instead of painting a single "true" version of a subject, Monet started painting the <em>same subject over and over</em>, at different times, to capture how light itself transformed it.</p>
          <p>His painting <strong>On the Bank of the Seine, Bennecourt</strong> (1868) is early Monet, right at the edge of what would become Impressionism — the water and sky are already loosening up, already more about atmosphere than topographical accuracy, but the brushwork is still tighter than what came later. By the time you get to <strong>Water Lily Pond</strong> (1900), painted in his own garden at Giverny decades later, the dissolution is nearly complete — there's barely a hard edge anywhere in the canvas; water, sky reflection, and lily pads blur into each other, built entirely from color relationships rather than outlines.</p>
          <p>What to look for if you're trying to spot a Monet specifically (versus another Impressionist): water and reflected light as a recurring subject, a tendency to work in series (haystacks, cathedral façades, water lilies, painted dozens of times each), and brushwork that gets progressively looser and more abstracted the later you go in his career — his late Giverny work borders on pure color-field painting.</p>
        `,
        examples: [
          { lookup: { type:'title', source:'aic', artist:'Claude Monet', titleKeyword:'Bennecourt' }, refLabel: 'On the Bank of the Seine, Bennecourt' },
          { lookup: { type:'id', source:'aic', id: 87088 }, refLabel: 'Water Lily Pond' }
        ],
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
            question: "Comparing Bennecourt (1868) to Water Lily Pond (1900) — did Monet's brushwork get tighter or looser over his career?",
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
        years: '1841–1919',
        movementId: 'impressionism',
        teaser: 'Pointed Impressionist technique at people instead of landscapes — warm, social, sun-lit scenes.',
        writeupHtml: `
          <p>Renoir (1841–1919) trained alongside Monet — the two painted side by side early on and pushed each other toward the loose, light-focused style that became Impressionism. But where Monet gravitated toward landscape and water, Renoir's lasting obsession was people: warm, sociable scenes of Parisian leisure — dances, boating parties, portraits of friends and family, always rendered with a kind of glowing, sun-warmed softness.</p>
          <p><strong>Two Sisters (On the Terrace)</strong> (1881) shows exactly this. It was painted at Chatou, a riverside town outside Paris that Renoir considered the most pleasant of all the Paris suburbs, and it captures two young women (not actually sisters — the models weren't related) on a terrace overlooking the Seine. Notice how the background landscape is almost entirely dissolved into soft color, while the figures themselves, though still loosely brushed, hold together with more solidity — Renoir is willing to let a landscape blur into abstraction in a way he rarely does with a human face. The palette leans warm throughout: pinks, warm blues, golden light, giving the whole scene a glow that feels distinct from Monet's cooler, more analytical relationship to color.</p>
          <p>What to look for to distinguish a Renoir from a Monet: people as the central subject rather than incidental, a warmer and rosier palette overall, and figures that stay relatively more defined and solid even as the surrounding scene dissolves into loose Impressionist brushwork.</p>
        `,
        examples: [
          { lookup: { type:'id', source:'aic', id: 14655 }, refLabel: 'Two Sisters (On the Terrace)' }
        ],
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
      }
    },

    subjects: {
      light: {
        id: 'light',
        kind: 'subject',
        title: 'Light',
        movementIds: ['impressionism'],
        teaser: 'The same problem, answered almost opposite ways: light as drama vs. light as the whole subject.',
        writeupHtml: `
          <p>Every movement in painting has had to answer the same question: what do you do with light? The answer changes completely depending on the era, and comparing two extremes makes the differences obvious fast.</p>
          <p>Take Rembrandt's <strong>Old Man with a Gold Chain</strong> (1631), a textbook example of Baroque light. Baroque painters — working roughly a century before Impressionism — used light as drama. A single strong source (often unseen, implied rather than shown) rakes across the subject, throwing everything else into deep, near-black shadow. It's theatrical and selective: light exists to sculpt form, create mood, and direct your eye to exactly one thing, usually a face. The background barely exists; it's swallowed in darkness on purpose.</p>
          <p>Now put that next to Monet's <strong>Water Lily Pond</strong> (1900) or, even more directly, his haystack series. Impressionist light works almost opposite to Baroque light: instead of one dramatic beam carving darkness out of a scene, light is <em>everywhere</em>, diffuse, and constantly shifting — the whole point is that there's no single "correct" lighting moment, only an endless series of temporary ones. Shadows in Impressionist painting aren't black voids; they're colored (often blue or violet), because Monet and his peers had realized shadows pick up reflected color from their surroundings rather than being the simple absence of light. Where Baroque light isolates a subject from its environment, Impressionist light dissolves the subject <em>into</em> its environment.</p>
          <p>The two paintings sit less than 300 years apart and represent almost opposite theories of what light is for in a painting: revelation-through-contrast versus light as the actual subject of the picture.</p>
        `,
        examples: [
          { lookup: { type:'title', source:'aic', artist:'Rembrandt van Rijn', titleKeyword:'Gold Chain' }, refLabel: 'Old Man with a Gold Chain' },
          { lookup: { type:'id', source:'aic', id: 87088 }, refLabel: 'Water Lily Pond' }
        ],
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
            question: 'Which approach treats light itself as the main subject of the painting — Baroque or Impressionism?',
            options: ['Baroque', 'Impressionism'],
            correct: 1
          }
        ]
      }
    },

    mediums: {}
  };
