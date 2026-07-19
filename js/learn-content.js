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
      }
    },

    mediums: {}
  };
