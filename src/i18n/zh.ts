import type { Messages } from "./en";

/**
 * 简体中文。Keys must match en.ts exactly — a missing or extra key is a type error.
 * Typography: full-width punctuation, “” quotes, —— dashes with no spaces around them.
 * Do not type spaces between Chinese and Latin text; CSS `text-autospace` adds them.
 */
export const zh: Messages = {
  meta: {
    siteName: "onemorething.today",
    titleHome: "陈广宇 Gabriel Chen — One more thing",
    titleTemplate: "{title} — 陈广宇",
    descriptionHome:
      "陈广宇（Gabriel Chen），Trimble 系统工程师，Flowgt 的打造者，现居新西兰基督城。这里是他的作品、文字，和 one more thing。",
    descriptionWriting: "陈广宇的文字、演讲与录音。",
    ogImageAlt: "One more thing. — onemorething.today",
    languageName: "中文",
  },
  nav: {
    skip: "跳到正文",
    home: "首页",
    writing: "文字",
    menu: "菜单",
    close: "关闭菜单",
    primary: "主导航",
    external: "（在新标签页打开）",
    switchTo: "切换到英文",
    langShort: "中",
    otherLangShort: "EN",
  },
  social: {
    github: "GitHub",
    linkedin: "领英",
    youtube: "YouTube",
    email: "邮件",
  },
  person: {
    name: "陈广宇",
    jobTitle: "系统工程师",
  },
  home: {
    overture: "One more thing.",
    helloTitle: "我是陈广宇。",
    helloLead: "Trimble系统工程师，Flowgt的打造者，现居新西兰基督城。",
    helloBody:
      "我做软件，也做软件背后的社区。我参与运营新西兰华人IT协会（CITANZ）基督城分会，也在黑客松担任导师。来新西兰之前，我在上海做了近十年系统研发——哔哩哔哩、中芯国际等。坎特伯雷大学应用数据科学硕士。我也画画，用马克笔。",
    workHeading: "作品与经历",
    writingHeading: "文字",
    writingAll: "全部文字",
    stageHeading: "One more thing",
    story1: "1998年1月6日，旧金山，Macworld大会。",
    story2: "乔布斯在主题演讲的最后，留了一个惊喜：苹果重新盈利了。",
    story3: "此后多年，这个压轴时刻有了名字——“One more thing”。",
    story4: "最好的东西，从来不在议程上。",
    story5: "这里是我的one more thing——就在今天。",
    sources: "资料来源",
    source1:
      "TidBITS，《Jobs Announces $45 Million Profit》，1998年1月6日——当天的报道：乔布斯在Macworld主题演讲结尾宣布了盈利消息。",
    source2:
      "维基百科，“Stevenote — One more thing…”：把1998年旧金山Macworld列为第一次，当时的说法是“One last thing”。",
  },
  work: {
    flowgt: {
      name: "Flowgt",
      role: "打造者",
      line: "为新西兰企业提供AI原生的技术人才：全职、合同与整支团队。",
    },
    loyal: {
      name: "loyalasabook",
      role: "作者",
      line: "中英双语读书与听书，一句一句来。",
    },
    trimble: {
      name: "Trimble",
      role: "系统工程师",
      line: "为坚固型野外控制器做软件与系统工程。",
    },
    citanz: {
      name: "CITANZ",
      role: "基督城分会轮值主席",
      line: "新西兰华人IT协会，每年约二十场社区活动。",
    },
    muse: {
      name: "The Muse",
      role: "IT志愿者，基督城",
      line: "让一家本地音乐公益机构的技术安静地运转。",
    },
  },
  writing: {
    title: "文字",
    intro: "笔记、演讲与录音。以英文为主，有时也写中文。",
    empty: "这里还空着。第一篇正在路上。",
    kindText: "文字",
    kindVideo: "视频",
    kindAudio: "音频",
    otherLangTag: "English",
    otherLangNote: "这篇只有英文版。",
    minutes: "{n}分钟",
  },
  post: {
    copyLink: "复制链接",
    copied: "链接已复制",
    prev: "上一篇",
    next: "下一篇",
    listen: "收听",
    play: "播放：{title}",
    notes: "说明",
    readInOther: "阅读英文版",
    backToWriting: "全部文字",
  },
  media: {
    coverAlt: "《{title}》的封面",
    videoFallback: "在YouTube上观看",
  },
  contact: {
    heading: "打个招呼。",
    copyEmail: "复制邮箱地址",
    copied: "邮箱地址已复制",
  },
  footer: {
    made: "写于基督城",
    privacy: "隐私",
    rss: "RSS",
    rights: "© {year} 陈广宇",
  },
  errors: {
    notFoundTitle: "这里什么也没有。",
    notFoundBody: "这不是你要找的那个one more thing。",
    backHome: "回到开头",
    goneTitle: "这篇文章已经下线。",
    serverTitle: "出了点问题。",
  },
  privacy: {
    title: "隐私",
    optOut: "不要统计我的访问",
    optIn: "重新统计我的访问",
    optedOut: "在这个浏览器上，你的访问不会被统计。",
  },
  rss: {
    title: "onemorething.today — 陈广宇",
    description: "陈广宇的文字、演讲与录音。",
  },
};
