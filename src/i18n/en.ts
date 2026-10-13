/**
 * English copy — the source of truth for every public string on the site.
 * zh.ts must provide exactly the same keys (enforced by the `Messages` type
 * and by scripts/i18n-check.mjs).
 *
 * Inline markup allowed in values: *emphasis* only (rendered by `rich()`).
 * Placeholders use {name} and must match across locales.
 */
export const en = {
  meta: {
    siteName: "onemorething.today",
    titleHome: "Gabriel Chen — One more thing",
    titleTemplate: "{title} — Gabriel Chen",
    descriptionHome:
      "Gabriel Chen is a systems engineer at Trimble and the founder of Flowgt, in Christchurch, New Zealand. Work, writing and one more thing.",
    descriptionWriting: "Notes, talks and recordings by Gabriel Chen.",
    ogImageAlt: "One more thing. — onemorething.today",
    languageName: "English",
  },
  nav: {
    skip: "Skip to content",
    home: "Home",
    writing: "Writing",
    menu: "Menu",
    close: "Close menu",
    primary: "Primary",
    external: "(opens in a new tab)",
    switchTo: "Switch to Chinese",
    langShort: "EN",
    otherLangShort: "中",
  },
  social: {
    github: "GitHub",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    email: "Email",
  },
  person: {
    name: "Gabriel Chen",
    jobTitle: "Systems engineer",
  },
  home: {
    overture: "One more thing.",
    helloTitle: "I’m *Gabriel Chen*.",
    helloLead: "Systems engineer at Trimble. Founder of Flowgt. Christchurch, New Zealand.",
    helloBody:
      "I build software, and the communities around it. I help run the Christchurch branch of CITANZ and mentor at hackathons. Before New Zealand I spent nearly a decade building systems in Shanghai — at Bilibili, SMIC and others. Master of Applied Data Science, University of Canterbury. I also draw, with marker pens.",
    workHeading: "Work",
    writingHeading: "Writing",
    writingAll: "All writing",
    stageHeading: "One more thing",
    story1: "January 6, 1998. Macworld Expo, San Francisco.",
    story2: "Steve Jobs ended his keynote with a surprise: Apple was profitable again.",
    story3: "In the years that followed, the surprise got a name — “One more thing.”",
    story4: "The best part was never on the agenda.",
    story5: "This is mine. *One more thing, today.*",
    sources: "Sources",
    source1:
      "TidBITS, “Jobs Announces $45 Million Profit”, 6 January 1998 — a same-day report that Jobs ended the Macworld keynote with the profit news.",
    source2:
      "Wikipedia, “Stevenote — One more thing…”: lists Macworld San Francisco 1998 as the first such moment, then worded “One last thing”.",
  },
  work: {
    flowgt: {
      name: "Flowgt",
      role: "Founder & architect",
      line: "AI-native talent for New Zealand companies: permanent roles, contracts and whole teams.",
    },
    loyal: {
      name: "loyalasabook",
      role: "Maker",
      line: "Read and listen to books in English and Chinese, one sentence at a time.",
    },
    trimble: {
      name: "Trimble",
      role: "Systems engineer",
      line: "Software and systems engineering for rugged field controllers.",
    },
    citanz: {
      name: "CITANZ",
      role: "Branch chair, Christchurch",
      line: "Chinese IT Association of New Zealand. Around twenty community events a year.",
    },
    muse: {
      name: "The Muse",
      role: "IT volunteer, Christchurch",
      line: "Keeping a local music charity’s technology quietly working.",
    },
  },
  writing: {
    title: "Writing",
    intro: "Notes, talks and recordings. In English, sometimes in Chinese.",
    empty: "Nothing here yet. The first one is on its way.",
    kindText: "Words",
    kindVideo: "Video",
    kindAudio: "Audio",
    otherLangTag: "中文",
    otherLangNote: "This post is only in Chinese.",
    minutes: "{n} min",
  },
  post: {
    copyLink: "Copy link",
    copied: "Link copied",
    prev: "Previous",
    next: "Next",
    listen: "Listen",
    play: "Play: {title}",
    notes: "Notes",
    readInOther: "Read in Chinese",
    backToWriting: "All writing",
  },
  media: {
    coverAlt: "Cover image for {title}",
    videoFallback: "Watch on YouTube",
  },
  contact: {
    heading: "Say hello.",
    copyEmail: "Copy email address",
    copied: "Email address copied",
  },
  footer: {
    made: "Made in Christchurch",
    privacy: "Privacy",
    rss: "RSS",
    rights: "© {year} Gabriel Chen",
  },
  errors: {
    notFoundTitle: "Nothing more here.",
    notFoundBody: "This isn’t the one more thing you were looking for.",
    backHome: "Back to the beginning",
    goneTitle: "This post was taken down.",
    serverTitle: "Something went wrong.",
  },
  privacy: {
    title: "Privacy",
    optOut: "Don’t count my visits",
    optIn: "Count my visits again",
    optedOut: "Your visits are not being counted on this browser.",
  },
  rss: {
    title: "onemorething.today — Gabriel Chen",
    description: "Writing, talks and recordings by Gabriel Chen.",
  },
} as const;

type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };
export type Messages = Widen<typeof en>;
