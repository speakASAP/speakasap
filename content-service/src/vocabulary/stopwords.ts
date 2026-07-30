export const STOPWORDS: Record<string, ReadonlySet<string>> = {
  de: new Set(['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines',
    'ich','du','er','sie','es','wir','ihr','und','oder','aber','in','zu','mit','von','ist','sind',
    'war','waren','nicht','auch','als','wie','an','auf','für','bei','nach','aus','um']),
  en: new Set(['the','a','an','i','you','he','she','it','we','they','and','or','but','in','to',
    'with','of','is','are','was','were','not','also','as','like','on','for','at','from','about']),
  fr: new Set(['le','la','les','un','une','des','je','tu','il','elle','nous','vous','ils','elles',
    'et','ou','mais','dans','a','avec','de','est','sont','etait','pas','aussi','comme','sur',
    'pour','chez','s','il','y','en']),
  es: new Set(['el','la','los','las','un','una','yo','tu','el','ella','nosotros','vosotros','ellos',
    'y','o','pero','en','a','con','de','es','son','era','no','tambien','como','sobre','para','por']),
  ru: new Set(['и','в','во','не','что','он','на','я','с','со','как','а','то','все','она','так',
    'его','но','да','ты','к','у','же','вы','за','бы','по','только','ее','мне','было','вот','от']),
};

export function stopwordsFor(languageCode: string): ReadonlySet<string> {
  return STOPWORDS[languageCode] ?? new Set<string>();
}
