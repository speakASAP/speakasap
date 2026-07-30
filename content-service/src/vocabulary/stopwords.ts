export const STOPWORDS: Record<string, ReadonlySet<string>> = {
  de: new Set(['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines',
    'ich','du','er','sie','es','wir','ihr','und','oder','aber','in','zu','mit','von','ist','sind',
    'war','waren','nicht','auch','als','wie','an','auf','für','bei','nach','aus','um']),
  // 't','s','ll','ve','re','d','m': contraction remnants left behind once the tokenizer
  // splits on apostrophes (don't -> don/t, John's -> john/s, they'll -> they/ll, etc.)
  en: new Set(['the','a','an','i','you','he','she','it','we','they','and','or','but','in','to',
    'with','of','is','are','was','were','not','also','as','like','on','for','at','from','about',
    't','s','ll','ve','re','d','m']),
  // 'était': accented form of 'etait' (unaccented can never match real text since the
  // tokenizer preserves diacritics); 'à'/'où' are distinct lexemes, not diacritic
  // variants of 'a'/'ou', and were missing entirely.
  // 'd','l','c','j','m','n','qu','t','s': elision remnants left behind once the
  // tokenizer splits on apostrophes (qu'est -> qu/est, l'ami -> l/ami, c'est -> c/est,
  // j'ai -> j/ai, d'un -> d/un, n'est -> n/est, m'a -> m/a).
  fr: new Set(['le','la','les','un','une','des','je','tu','il','elle','nous','vous','ils','elles',
    'et','ou','mais','dans','a','avec','de','est','sont','etait','pas','aussi','comme','sur',
    'pour','chez','s','il','y','en','était','à','où',
    'd','l','c','j','m','n','qu','t',
    // Frequent function words missing from the original list. Their absence let them count
    // as content words, and it also kept 'est-ce' alive: a hyphenated token is only dropped
    // when EVERY part is a stopword, and 'ce' was not one.
    'ce','que','qui','ne','on','se','au','aux','du']),
  // 'él'/'tú'/'también': accented forms distinct from (or unmatchable without accents from)
  // the unaccented 'el'/'tu'/'tambien' already present. The original list's second 'el'
  // was a duplicate of the article and has been replaced by 'él' (the pronoun).
  es: new Set(['el','la','los','las','un','una','yo','tu','ella','nosotros','vosotros','ellos',
    'y','o','pero','en','a','con','de','es','son','era','no','tambien','como','sobre','para','por',
    'él','tú','también']),
  // 'её'/'всё': ё-spelled forms distinct from (or unmatchable without the diaeresis from)
  // the е-spelled 'ее'/'все' already present.
  ru: new Set(['и','в','во','не','что','он','на','я','с','со','как','а','то','все','она','так',
    'его','но','да','ты','к','у','же','вы','за','бы','по','только','ее','мне','было','вот','от',
    'её','всё']),
};

export function stopwordsFor(languageCode: string): ReadonlySet<string> {
  return STOPWORDS[languageCode] ?? new Set<string>();
}
