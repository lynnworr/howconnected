import { readFile, writeFile } from "node:fs/promises";

const REVIEWED_AT = "2026-10-12T00:00:00.000Z";
const VERIFICATION_DATE = "2026-10-12";
const wd = (qid, propertyId, label = `${qid} ${propertyId} statement`) => ({ label, publisher: "Wikidata", url: `https://www.wikidata.org/wiki/${qid}#${propertyId}`, kind: "wikidata" });
const supporting = (label, publisher, url) => ({ label, publisher, url, kind: "supporting" });
const node = (qid, name, article) => ({ qid, name, wikipediaUrl: `https://en.wikipedia.org/wiki/${article}`, wikidataUrl: `https://www.wikidata.org/wiki/${qid}` });
const qualifier = (propertyId, label, value) => ({ propertyId, label, value });
const option = (qid, label) => ({ id: label.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), label, qid });
const edge = (propertyId, subjectQid, objectQid, direction, label, qualifiers, expectedClaim, source) => ({
  propertyId, subjectQid, objectQid, direction, label, qualifiers, expectedClaim,
  evidence: [wd(subjectQid, propertyId), source],
});

const definitions = [
  {
    id: "linux-torvalds-git", title: "One creator, two foundations", category: "Technology",
    prompt: "Who is the missing link between Linux and Git?",
    path: [node("Q14579", "Linux kernel", "Linux_kernel"), node("Q34253", "Linus Torvalds", "Linus_Torvalds"), node("Q186055", "Git", "Git")],
    relationships: [
      edge("P178", "Q14579", "Q34253", "forward", "developed by", [], "Q14579 P178 Q34253", supporting("A Short History of Git", "Git", "https://git-scm.com/book/en/v2/Getting-Started-A-Short-History-of-Git")),
      edge("P178", "Q186055", "Q34253", "reverse", "developer of", [qualifier("P580", "start time", "8 April 2005"), qualifier("P582", "end time", "2005")], "Q186055 P178 Q34253, qualified by P580 2005-04-08 and P582 2005 (displayed in reverse)", supporting("A Short History of Git", "Git", "https://git-scm.com/book/en/v2/Getting-Started-A-Short-History-of-Git")),
    ],
    distractors: [option("Q7439", "Richard Stallman"), option("Q1107006", "Ken Thompson"), option("Q92608", "Brian Kernighan")],
    explanation: "Linus Torvalds created Linux and, when the kernel community needed a new distributed version-control tool in 2005, initiated Git. One developer therefore anchors both a landmark operating-system kernel and the tool used to coordinate much of modern software development.",
  },
  {
    id: "python-rossum-microsoft", title: "Python's later chapter", category: "Technology",
    prompt: "Who is the missing link between Python and Microsoft?",
    path: [node("Q28865", "Python", "Python_(programming_language)"), node("Q30942", "Guido van Rossum", "Guido_van_Rossum"), node("Q2283", "Microsoft", "Microsoft")],
    relationships: [
      edge("P178", "Q28865", "Q30942", "forward", "created by", [], "Q28865 P178 Q30942", supporting("How people behind well-known technologies are shaping AI at Microsoft", "Microsoft", "https://news.microsoft.com/source/features/innovation/how-6-people-behind-well-known-technologies-are-shaping-ai-at-microsoft/")),
      edge("P108", "Q30942", "Q2283", "forward", "worked at", [qualifier("P580", "start time", "November 2020")], "Q30942 P108 Q2283, qualified by P580 2020-11", supporting("How people behind well-known technologies are shaping AI at Microsoft", "Microsoft", "https://news.microsoft.com/source/features/innovation/how-6-people-behind-well-known-technologies-are-shaping-ai-at-microsoft/")),
    ],
    distractors: [option("Q92622", "James Gosling"), option("Q92648", "Brendan Eich"), option("Q92620", "Bjarne Stroustrup")],
    explanation: "Guido van Rossum invented Python and joined Microsoft in 2020. At Microsoft he continued work on Python performance before moving into AI-related engineering, connecting the language's origins to a later corporate chapter.",
  },
  {
    id: "air-jordan-nike-phil-knight", title: "From signature shoe to founder", category: "Business",
    prompt: "Which company is the missing link between Air Jordan and Phil Knight?",
    path: [node("Q420953", "Air Jordan", "Air_Jordan"), node("Q483915", "Nike", "Nike,_Inc."), node("Q557305", "Phil Knight", "Phil_Knight")],
    relationships: [
      edge("P127", "Q420953", "Q483915", "forward", "historically owned by", [qualifier("P580", "start time", "1985"), qualifier("P582", "end time", "1997")], "Q420953 P127 Q483915, qualified by P580 1985 and P582 1997", supporting("How the Air Jordan 1 sparked a sneaker revolution", "Nike", "https://www.nike.com/a/air-jordan-banned-history/")),
      edge("P112", "Q483915", "Q557305", "forward", "co-founded by", [], "Q483915 P112 Q557305", supporting("Phil Knight, Chairman Emeritus", "Nike", "https://about.nike.com/en/company/people/philip-h-knight")),
    ],
    distractors: [option("Q3895", "Adidas"), option("Q466183", "Reebok"), option("Q319515", "Converse")],
    explanation: "Wikidata's Air Jordan ownership statement links the line to Nike for 1985–1997, the period in which it grew from a signature shoe into a cultural franchise. Phil Knight co-founded Nike; the dated qualifier is essential and this puzzle does not claim that the same ownership statement is unbounded today.",
    qualifierNote: "The Air Jordan P127 statement is explicitly bounded to 1985–1997 and a separate current statement points to Jordan Brand. Editorial wording preserves the historical scope and avoids a present-tense ownership claim.",
  },
  {
    id: "paypal-thiel-palantir", title: "A founder across fintech and data", category: "Business",
    prompt: "Who is the missing link between PayPal and Palantir Technologies?",
    path: [node("Q483959", "PayPal", "PayPal"), node("Q705525", "Peter Thiel", "Peter_Thiel"), node("Q2047336", "Palantir Technologies", "Palantir")],
    relationships: [
      edge("P112", "Q483959", "Q705525", "forward", "co-founded by", [], "Q483959 P112 Q705525", supporting("Palantir profile: Peter Thiel, PayPal co-founder", "Palantir", "https://www.palantir.com/assets/xrfr7uokpv1b/7gAv31itTL8WJ9ytHX7rJy/68238b407b8f2e9c6c86bcf77a127ee9/11809_Tel_Palantir_22042023_A.pdf")),
      edge("P112", "Q2047336", "Q705525", "reverse", "co-founder of", [], "Q2047336 P112 Q705525 (displayed in reverse)", supporting("Palantir profile: Peter Thiel, PayPal co-founder", "Palantir", "https://www.palantir.com/assets/xrfr7uokpv1b/7gAv31itTL8WJ9ytHX7rJy/68238b407b8f2e9c6c86bcf77a127ee9/11809_Tel_Palantir_22042023_A.pdf")),
    ],
    distractors: [option("Q317521", "Elon Musk"), option("Q93014", "Max Levchin"), option("Q211098", "Reid Hoffman")],
    explanation: "Peter Thiel co-founded PayPal and later co-founded Palantir Technologies. The link traces how experience with online-payment fraud helped inform a new company built around analysis of complex data.",
  },
  {
    id: "jolene-dolly-dollywood", title: "A song and a Smoky Mountains park", category: "Music",
    prompt: "Who is the missing link between “Jolene” and Dollywood?",
    path: [node("Q1573997", "Jolene", "Jolene"), node("Q180453", "Dolly Parton", "Dolly_Parton"), node("Q530744", "Dollywood", "Dollywood")],
    relationships: [
      edge("P175", "Q1573997", "Q180453", "forward", "performed by", [qualifier("P10663", "recording of performance", "Q64903177"), qualifier("P577", "publication date", "September 1973")], "Q1573997 P175 Q180453, original recording qualified by P10663 Q64903177 and P577 1973-09", supporting("Dolly Parton biography", "Dolly Parton", "https://www.dollyparton.com/bio")),
      edge("P127", "Q530744", "Q180453", "reverse", "owner of", [qualifier("P580", "start time", "1986")], "Q530744 P127 Q180453, qualified by P580 1986 (displayed in reverse)", supporting("Dolly Parton destinations", "Dolly Parton", "https://www.dollyparton.com/destinations")),
    ],
    distractors: [option("Q272931", "Loretta Lynn"), option("Q231286", "Emmylou Harris"), option("Q229430", "Reba McEntire")],
    explanation: "Dolly Parton recorded “Jolene” in 1973 and opened Dollywood in 1986. The connection joins one of her defining songs to the Tennessee attraction through which she invested in her home region.",
  },
  {
    id: "rolling-stone-dylan-nobel-literature", title: "A song to a literary laureate", category: "Music",
    prompt: "Who is the missing link between “Like a Rolling Stone” and the Nobel Prize in Literature?",
    path: [node("Q214430", "Like a Rolling Stone", "Like_a_Rolling_Stone"), node("Q392", "Bob Dylan", "Bob_Dylan"), node("Q37922", "Nobel Prize in Literature", "Nobel_Prize_in_Literature")],
    relationships: [
      edge("P175", "Q214430", "Q392", "forward", "performed by", [qualifier("P10663", "recording of performance", "Q109984238"), qualifier("P577", "publication date", "June 1965")], "Q214430 P175 Q392, original recording qualified by P10663 Q109984238 and P577 1965-06", supporting("Bob Dylan Nobel biobibliography", "Nobel Prize", "https://www.nobelprize.org/uploads/2018/06/bio-bibl-39.pdf")),
      edge("P166", "Q392", "Q37922", "forward", "received award", [qualifier("P585", "point in time", "2016")], "Q392 P166 Q37922, qualified by P585 2016", supporting("The Nobel Prize in Literature 2016", "Nobel Prize", "https://www.nobelprize.org/prizes/literature/2016/summary/")),
    ],
    distractors: [option("Q4028", "Paul Simon"), option("Q1276", "Leonard Cohen"), option("Q1225", "Bruce Springsteen")],
    explanation: "Bob Dylan performed “Like a Rolling Stone” and received the 2016 Nobel Prize in Literature. The award recognized the poetic expressions he created within the American song tradition, making a landmark recording part of a broader literary legacy.",
  },
  {
    id: "hamilton-miranda-moana", title: "Broadway meets the Pacific", category: "Entertainment and film",
    prompt: "Who is the missing link between Hamilton and Moana?",
    path: [node("Q19320959", "Hamilton", "Hamilton_(musical)"), node("Q1646482", "Lin-Manuel Miranda", "Lin-Manuel_Miranda"), node("Q18647981", "Moana", "Moana_(2016_film)")],
    relationships: [
      edge("P86", "Q19320959", "Q1646482", "forward", "music by", [], "Q19320959 P86 Q1646482", supporting("Hamilton", "Disney", "https://movies.disney.com/hamilton")),
      edge("P86", "Q18647981", "Q1646482", "reverse", "composer for", [qualifier("P518", "applies to part", "songs (Q7366)")], "Q18647981 P86 Q1646482, qualified by P518 Q7366 (displayed in reverse)", supporting("Disney's Moana", "Lin-Manuel Miranda", "https://www.linmanuel.com/project/moana/")),
    ],
    distractors: [option("Q317272", "Alan Menken"), option("Q3435778", "Robert Lopez"), option("Q153579", "Stephen Sondheim")],
    explanation: "Lin-Manuel Miranda wrote Hamilton's book, music, and lyrics, then contributed original songs to Disney's Moana. His work connects a history-changing stage musical with an animated voyage rooted in Pacific storytelling.",
  },
  {
    id: "eiffel-tower-eiffel-statue-liberty", title: "Iron inside two icons", category: "Literature and art",
    prompt: "Who is the missing link between the Eiffel Tower and the Statue of Liberty?",
    path: [node("Q243", "Eiffel Tower", "Eiffel_Tower"), node("Q20882", "Gustave Eiffel", "Gustave_Eiffel"), node("Q9202", "Statue of Liberty", "Statue_of_Liberty")],
    relationships: [
      edge("P138", "Q243", "Q20882", "forward", "named after", [], "Q243 P138 Q20882", supporting("Alexandre-Gustave Eiffel", "U.S. National Park Service", "https://home.nps.gov/stli/learn/historyculture/alexandre-gustave-eiffel.htm")),
      edge("P800", "Q20882", "Q9202", "forward", "notable work", [qualifier("P585", "point in time", "1884")], "Q20882 P800 Q9202, qualified by P585 1884", supporting("Alexandre-Gustave Eiffel", "U.S. National Park Service", "https://home.nps.gov/stli/learn/historyculture/alexandre-gustave-eiffel.htm")),
    ],
    distractors: [option("Q223274", "Frédéric Auguste Bartholdi"), option("Q778243", "Stéphen Sauvestre"), option("Q272912", "Eugène Viollet-le-Duc")],
    explanation: "The Eiffel Tower bears Gustave Eiffel's name, and Eiffel designed the Statue of Liberty's internal iron support system. The two monuments look very different, but both depend on his structural engineering.",
  },
  {
    id: "frankenstein-shelley-wollstonecraft", title: "A literary family line", category: "Literature and art",
    prompt: "Who is the missing link between Frankenstein and Mary Wollstonecraft?",
    path: [node("Q150827", "Frankenstein", "Frankenstein"), node("Q47152", "Mary Shelley", "Mary_Shelley"), node("Q101638", "Mary Wollstonecraft", "Mary_Wollstonecraft")],
    relationships: [
      edge("P50", "Q150827", "Q47152", "forward", "written by", [], "Q150827 P50 Q47152", supporting("Mary Shelley's Frankenstein", "British Library", "https://www.britishlibrary.cn/en/works/frankenstein/")),
      edge("P25", "Q47152", "Q101638", "forward", "mother", [], "Q47152 P25 Q101638", supporting("Mary Shelley", "British Library", "https://www.britishlibrary.cn/en/authors/mary-shelley/")),
    ],
    distractors: [option("Q93343", "Percy Bysshe Shelley"), option("Q5679", "Lord Byron"), option("Q460066", "Claire Clairmont")],
    explanation: "Mary Shelley wrote Frankenstein and was the daughter of the pioneering writer Mary Wollstonecraft. Wollstonecraft died days after Mary's birth, but her intellectual legacy remained central to the world in which Shelley became an author.",
  },
  {
    id: "little-prince-saint-exupery-aeropostale", title: "The aviator behind a prince", category: "Literature and art",
    prompt: "Who is the missing link between The Little Prince and Aéropostale?",
    path: [node("Q25338", "The Little Prince", "The_Little_Prince"), node("Q2908", "Antoine de Saint-Exupéry", "Antoine_de_Saint-Exupéry"), node("Q2723467", "Aéropostale", "Aéropostale_(aviation)")],
    relationships: [
      edge("P50", "Q25338", "Q2908", "forward", "written by", [], "Q25338 P50 Q2908", supporting("The work of Antoine de Saint-Exupéry", "Antoine de Saint-Exupéry estate", "https://www.antoinedesaintexupery.org/oeuvre/")),
      edge("P108", "Q2908", "Q2723467", "forward", "worked for", [qualifier("P580", "start time", "1926"), qualifier("P582", "end time", "1936")], "Q2908 P108 Q2723467, qualified by P580 1926 and P582 1936", supporting("About The Little Prince", "Antoine de Saint-Exupéry estate", "https://www.blog.lepetitprince.com/a-propos/")),
    ],
    distractors: [option("Q680897", "Jean Mermoz"), option("Q34670", "Albert Camus"), option("Q356537", "Joseph Kessel")],
    explanation: "Antoine de Saint-Exupéry wrote The Little Prince and flew mail routes for Aéropostale. His experience as an aviator—including desert danger and isolation—fed the imaginative and philosophical world of his best-known book.",
  },
  {
    id: "march-washington-king-nobel-peace", title: "From a march to Oslo", category: "History and politics",
    prompt: "Who is the missing link between the March on Washington and the Nobel Peace Prize?",
    path: [node("Q1128871", "March on Washington for Jobs and Freedom", "March_on_Washington"), node("Q8027", "Martin Luther King Jr.", "Martin_Luther_King_Jr."), node("Q35637", "Nobel Peace Prize", "Nobel_Peace_Prize")],
    relationships: [
      edge("P793", "Q8027", "Q1128871", "reverse", "participant", [], "Q8027 P793 Q1128871 (displayed in reverse)", supporting("King chronology", "Martin Luther King Jr. Research and Education Institute", "https://kinginstitute.stanford.edu/king-resources/king-encyclopedia/chronology")),
      edge("P166", "Q8027", "Q35637", "forward", "received award", [qualifier("P585", "point in time", "1964")], "Q8027 P166 Q35637, qualified by P585 1964", supporting("Nobel Peace Prize", "Martin Luther King Jr. Research and Education Institute", "https://kinginstitute.stanford.edu/nobel-peace-prize")),
    ],
    distractors: [option("Q720153", "A. Philip Randolph"), option("Q187930", "Bayard Rustin"), option("Q43303", "Malcolm X")],
    explanation: "Martin Luther King Jr. spoke at the 1963 March on Washington and received the Nobel Peace Prize the following year. The path links a defining public demonstration of the civil-rights movement to international recognition of King's nonviolent leadership.",
  },
  {
    id: "cuban-crisis-kennedy-pulitzer-biography", title: "A president, a crisis, and a prize", category: "History and politics",
    prompt: "Who is the missing link between the Cuban Missile Crisis and the Pulitzer Prize for Biography?",
    path: [node("Q128160", "Cuban Missile Crisis", "Cuban_Missile_Crisis"), node("Q9696", "John F. Kennedy", "John_F._Kennedy"), node("Q285117", "Pulitzer Prize for Biography", "Pulitzer_Prize_for_Biography")],
    relationships: [
      edge("P793", "Q9696", "Q128160", "reverse", "participant", [], "Q9696 P793 Q128160 (displayed in reverse)", supporting("Cuban Missile Crisis records", "John F. Kennedy Presidential Library", "https://www.jfklibrary.org/learn/about-jfk/jfk-in-history/cuban-missile-crisis")),
      edge("P166", "Q9696", "Q285117", "forward", "received award", [qualifier("P585", "point in time", "1957"), qualifier("P1686", "for work", "Profiles in Courage (Q206795)")], "Q9696 P166 Q285117, qualified by P585 1957 and P1686 Q206795", supporting("Profiles in Courage", "John F. Kennedy Presidential Library", "https://store.jfklibrary.org/products/sample-product-5")),
    ],
    distractors: [option("Q35314", "Nikita Khrushchev"), option("Q25310", "Robert F. Kennedy"), option("Q518197", "Ted Sorensen")],
    explanation: "John F. Kennedy led the United States during the Cuban Missile Crisis and had earlier received the 1957 Pulitzer Prize for Profiles in Courage. The connection juxtaposes the president's most dangerous international confrontation with his award-winning study of political courage.",
  },
  {
    id: "hubble-telescope-hubble-chicago", title: "A telescope's academic namesake", category: "Science and innovation",
    prompt: "Who is the missing link between the Hubble Space Telescope and the University of Chicago?",
    path: [node("Q2513", "Hubble Space Telescope", "Hubble_Space_Telescope"), node("Q43027", "Edwin Hubble", "Edwin_Hubble"), node("Q131252", "University of Chicago", "University_of_Chicago")],
    relationships: [
      edge("P138", "Q2513", "Q43027", "forward", "named after", [qualifier("P585", "point in time", "1983")], "Q2513 P138 Q43027, qualified by P585 1983", supporting("Two Hubbles Achieve Great Heights", "NASA", "https://science.nasa.gov/missions/hubble/nasa-two-hubbles-achieve-great-heights/")),
      edge("P69", "Q43027", "Q131252", "forward", "educated at", [], "Q43027 P69 Q131252", supporting("Two Hubbles Achieve Great Heights", "NASA", "https://science.nasa.gov/missions/hubble/nasa-two-hubbles-achieve-great-heights/")),
    ],
    distractors: [option("Q410", "Carl Sagan"), option("Q148109", "Subrahmanyan Chandrasekhar"), option("Q1615", "Neil Armstrong")],
    explanation: "NASA named the Hubble Space Telescope for astronomer Edwin Hubble, who earned his bachelor's degree and later his doctorate at the University of Chicago. The observatory's name therefore points back to the institution where Hubble trained.",
  },
  {
    id: "halley-comet-halley-royal-society", title: "A predicted return", category: "Science and innovation",
    prompt: "Who is the missing link between Halley's Comet and the Royal Society?",
    path: [node("Q23054", "Halley's Comet", "Halley%27s_Comet"), node("Q47434", "Edmond Halley", "Edmond_Halley"), node("Q123885", "Royal Society", "Royal_Society")],
    relationships: [
      edge("P138", "Q23054", "Q47434", "forward", "named after", [], "Q23054 P138 Q47434", supporting("Magnetic Halley", "Royal Society", "https://royalsociety.org/blog/2023/10/magnetic-halley/")),
      edge("P463", "Q47434", "Q123885", "forward", "member of", [qualifier("P580", "start time", "30 November 1678")], "Q47434 P463 Q123885, qualified by P580 1678-11-30", supporting("Magnetic Halley", "Royal Society", "https://royalsociety.org/blog/2023/10/magnetic-halley/")),
    ],
    distractors: [option("Q935", "Isaac Newton"), option("Q46830", "Robert Hooke"), option("Q242388", "John Flamsteed")],
    explanation: "Halley's Comet is named for Edmond Halley, who calculated its orbit and predicted its return. Halley had been elected a Fellow of the Royal Society in 1678, decades before the comet returned as he forecast.",
  },
  {
    id: "black-panther-boseman-42", title: "A hero and a history-maker", category: "Entertainment and film",
    prompt: "Who is the missing link between Black Panther and 42?",
    path: [node("Q23780734", "Black Panther", "Black_Panther_(film)"), node("Q5066520", "Chadwick Boseman", "Chadwick_Boseman"), node("Q3599091", "42", "42_(film)")],
    relationships: [
      edge("P161", "Q23780734", "Q5066520", "forward", "cast member", [qualifier("P453", "character role", "T'Challa (Q24004885)"), qualifier("P4633", "name of character role", "T’Challa/Black Panther"), qualifier("P1545", "series ordinal", "1")], "Q23780734 P161 Q5066520, qualified by P453 Q24004885, P4633 T’Challa/Black Panther, and P1545 1", supporting("Black Panther cast", "Marvel", "https://www.marvel.com/articles/movies/sterling-k-brown-signs-on-to-marvel-s-black-panther")),
      edge("P161", "Q3599091", "Q5066520", "reverse", "cast member in", [qualifier("P453", "character role", "Jackie Robinson (Q221048)"), qualifier("P4633", "name of character role", "Jackie Robinson")], "Q3599091 P161 Q5066520, qualified by P453 Q221048 and P4633 Jackie Robinson (displayed in reverse)", supporting("Chadwick Boseman tribute", "Marvel", "https://www.marvel.com/articles/movies/chadwick-boseman-special-tribute-for-a-king")),
    ],
    distractors: [option("Q3308007", "Michael B. Jordan"), option("Q3840847", "Lupita Nyong'o"), option("Q636653", "Danai Gurira")],
    explanation: "Chadwick Boseman played T'Challa in Black Panther and Jackie Robinson in 42. The pairing highlights two of his defining screen roles: a fictional African king and a real athlete who broke Major League Baseball's color barrier.",
  },
  {
    id: "spirited-away-miyazaki-ghibli", title: "The filmmaker behind the bathhouse", category: "Entertainment and film",
    prompt: "Who is the missing link between Spirited Away and Studio Ghibli?",
    path: [node("Q155653", "Spirited Away", "Spirited_Away"), node("Q55400", "Hayao Miyazaki", "Hayao_Miyazaki"), node("Q182950", "Studio Ghibli", "Studio_Ghibli")],
    relationships: [
      edge("P57", "Q155653", "Q55400", "forward", "directed by", [], "Q155653 P57 Q55400", supporting("Spirited Away", "Studio Ghibli", "https://studioghibli.jp/films/spirited-away/")),
      edge("P112", "Q182950", "Q55400", "reverse", "co-founder of", [], "Q182950 P112 Q55400 (displayed in reverse)", supporting("Hayao Miyazaki", "Studio Ghibli", "https://studioghibli.jp/directors/hayao-miyazaki/")),
    ],
    distractors: [option("Q178713", "Isao Takahata"), option("Q713511", "Toshio Suzuki"), option("Q720771", "Mamoru Hosoda")],
    explanation: "Hayao Miyazaki directed Spirited Away and helped establish Studio Ghibli in 1985. The film became one of the studio's defining works, bringing Miyazaki's imagined spirit world to a global audience.",
  },
  {
    id: "senna-ayrton-mclaren", title: "A racing life on film", category: "Sports",
    prompt: "Who is the missing link between Senna and McLaren?",
    path: [node("Q534785", "Senna", "Senna_(film)"), node("Q10490", "Ayrton Senna", "Ayrton_Senna"), node("Q172030", "McLaren", "McLaren")],
    relationships: [
      edge("P921", "Q534785", "Q10490", "forward", "main subject", [], "Q534785 P921 Q10490", supporting("McLaren at the movies: Senna", "McLaren", "https://www.mclaren.com/racing/heritage/mclaren-at-the-movies/")),
      edge("P54", "Q10490", "Q172030", "forward", "raced for", [qualifier("P580", "start time", "1 January 1988"), qualifier("P582", "end time", "1 January 1993"), qualifier("P3438", "season", "Q172621, Q172532, Q48772120, Q172674, Q172669, Q172698")], "Q10490 P54 Q172030, qualified by P580 1988-01-01, P582 1993-01-01, and six P3438 season values", supporting("McLaren's Formula 1 champions", "McLaren", "https://www.mclaren.com/racing/heritage/mclarens-formula-1-champions/")),
    ],
    distractors: [option("Q10494", "Alain Prost"), option("Q9673", "Lewis Hamilton"), option("Q9671", "Michael Schumacher")],
    explanation: "The documentary Senna centers on Ayrton Senna, whose six seasons with McLaren produced three Formula One world championships. The film's archival racing story is inseparable from the team behind many of his greatest drives.",
  },
  {
    id: "oprah-show-winfrey-own", title: "A host builds a network", category: "Business",
    prompt: "Who is the missing link between The Oprah Winfrey Show and OWN?",
    path: [node("Q694106", "The Oprah Winfrey Show", "The_Oprah_Winfrey_Show"), node("Q55800", "Oprah Winfrey", "Oprah_Winfrey"), node("Q2573619", "OWN", "Oprah_Winfrey_Network")],
    relationships: [
      edge("P371", "Q694106", "Q55800", "forward", "presented by", [], "Q694106 P371 Q55800", supporting("Oprah Winfrey biography", "ABC", "https://www.dgepress.com/abc/bios/oprah-winfrey/")),
      edge("P112", "Q2573619", "Q55800", "reverse", "co-founder of", [], "Q2573619 P112 Q55800 (displayed in reverse)", supporting("About OWN", "Warner Bros. Discovery", "https://press.wbd.com/us/brands/own")),
    ],
    distractors: [option("Q5528805", "Gayle King"), option("Q483325", "Ellen DeGeneres"), option("Q1336253", "Phil Donahue")],
    explanation: "Oprah Winfrey hosted and produced The Oprah Winfrey Show for 25 years and then co-created OWN as a joint venture through Harpo. The path follows her move from a defining program to a network built around a broader media vision.",
  },
];

const makePuzzle = (definition) => {
  const answer = option(definition.path[1].qid, definition.path[1].name);
  const options = [answer, ...definition.distractors];
  return {
    id: definition.id, format: "missing-link", title: definition.title, prompt: definition.prompt, category: definition.category,
    status: "approved", path: definition.path, hiddenNodeIndex: 1, relationships: definition.relationships,
    options, correctOptionId: answer.id, explanation: definition.explanation,
    pathFingerprint: `${definition.path[0].qid}|${definition.relationships[0].propertyId}:${definition.relationships[0].direction}:${definition.path[1].qid}|${definition.relationships[1].propertyId}:${definition.relationships[1].direction}:${definition.path[2].qid}`,
    reviewedAt: REVIEWED_AT, verificationDate: VERIFICATION_DATE,
    reviewHistory: [
      { at: REVIEWED_AT, from: null, to: "under-review", note: "Selected for bounded Phase 6C batch 2 independent verification." },
      { at: REVIEWED_AT, from: "under-review", to: "approved", note: "Current Wikidata statements, qualifiers, English Wikipedia links, independent supporting sources, path uniqueness, and three distractors reviewed." },
    ],
  };
};

const rejected = [
  {
    id: "berkshire-buffett-giving-pledge", decision: "rejected",
    exactPath: "Berkshire Hathaway (Q217583) —P127→ Warren Buffett (Q47213) ←P112— The Giving Pledge (Q203807)",
    reason: "Rejected as ambiguous: the bounded live query returns both Warren Buffett (Q47213) and Bill Gates (Q5284), because each appears in Berkshire Hathaway's P127 statements and The Giving Pledge's P112 statements.",
    qualifierConcerns: "The Warren Buffett ownership statement includes P1107 0.33 and P585 2016-03-02. Those qualifiers describe the statement but do not eliminate Bill Gates as a second exact-property intermediary.",
    sourceEvidence: [
      { label: "Berkshire Hathaway owner statement", url: "https://www.wikidata.org/wiki/Q217583#P127" },
      { label: "The Giving Pledge founder statement", url: "https://www.wikidata.org/wiki/Q203807#P112" },
      { label: "The Giving Pledge", url: "https://www.givingpledge.org/" },
    ],
    distractors: [
      { qid: "Q5284", label: "Bill Gates", exactPathMatch: true },
      { qid: "Q918630", label: "Charlie Munger", exactPathMatch: false },
      { qid: "Q463877", label: "Melinda French Gates", exactPathMatch: false },
    ],
    distractorValidationOutcome: "Failed: Bill Gates is a plausible distractor and satisfies both exact edges, so the intended answer is not unique.", uniqueIntermediaryCount: 2,
  },
  {
    id: "blind-side-oher-ravens", decision: "rejected",
    exactPath: "The Blind Side (Q206497) —P921→ Michael Oher (Q977601) —P54→ Baltimore Ravens (Q276539)",
    reason: "Rejected because the second current Wikidata claim is absent: Michael Oher's P54 statements do not currently include the Baltimore Ravens, so the proposed exact path cannot be verified even though reliable historical sources confirm he played for the team.",
    qualifierConcerns: "The missing P54 statement means there are no current Ravens-specific Wikidata qualifiers to review. External evidence cannot substitute for the registry's required structured claim.",
    sourceEvidence: [
      { label: "The Blind Side main-subject statement", url: "https://www.wikidata.org/wiki/Q206497#P921" },
      { label: "Michael Oher team statements", url: "https://www.wikidata.org/wiki/Q977601#P54" },
      { label: "2009 Ravens Draft Release", url: "https://www.baltimoreravens.com/news/2009-ravens-draft-release-7745121" },
    ],
    distractors: [
      { qid: "Q40791", label: "Sandra Bullock", exactPathMatch: false },
      { qid: "Q6519525", label: "Leigh Anne Tuohy", exactPathMatch: false },
      { qid: "Q2093874", label: "Quinton Aaron", exactPathMatch: false },
    ],
    distractorValidationOutcome: "Failed before distractor promotion: none of the candidates, including Michael Oher, completes the proposed current two-edge Wikidata path.", uniqueIntermediaryCount: 0,
  },
];

const registryUrl = new URL("../content/daily-puzzles.json", import.meta.url);
const registry = JSON.parse(await readFile(registryUrl, "utf8"));
const ids = new Set(registry.map((item) => item.id));
const present = definitions.filter((item) => ids.has(item.id));
if (present.length && present.length !== definitions.length) throw new Error(`Partial Batch 2 registry state: ${present.length}/${definitions.length} approved records already exist.`);
if (!present.length) {
  registry.push(...definitions.map(makePuzzle));
  await writeFile(registryUrl, `${JSON.stringify(registry, null, 2)}\n`);
} else {
  const refreshed = new Map(definitions.map((item) => [item.id, makePuzzle(item)]));
  await writeFile(registryUrl, `${JSON.stringify(registry.map((item) => refreshed.get(item.id) ?? item), null, 2)}\n`);
}

const approvedAudit = definitions.map((definition) => {
  const puzzle = makePuzzle(definition);
  const qualifiers = puzzle.relationships.flatMap((relationship) => relationship.qualifiers.map((item) => `${relationship.propertyId}/${item.propertyId} ${item.label}: ${item.value}`));
  return {
    id: puzzle.id, decision: "approved",
    reason: "Both current Wikidata statements and direction were confirmed; reliable supporting sources cover each material claim; the bounded exact-property query returned only the intended intermediary.",
    exactPath: `${puzzle.path[0].name} (${puzzle.path[0].qid}) ${puzzle.relationships[0].direction === "forward" ? `—${puzzle.relationships[0].propertyId}→` : `←${puzzle.relationships[0].propertyId}—`} ${puzzle.path[1].name} (${puzzle.path[1].qid}) ${puzzle.relationships[1].direction === "forward" ? `—${puzzle.relationships[1].propertyId}→` : `←${puzzle.relationships[1].propertyId}—`} ${puzzle.path[2].name} (${puzzle.path[2].qid})`,
    qualifierConcerns: definition.qualifierNote ?? (qualifiers.length ? `Reviewed: ${qualifiers.join("; ")}. Editorial wording does not claim more than the dated or role-specific statements support.` : "No material qualifiers on either current statement."),
    sourceEvidence: puzzle.relationships.flatMap((relationship) => relationship.evidence),
    wikipediaLinks: puzzle.path.map((item) => ({ qid: item.qid, url: item.wikipediaUrl })),
    distractors: definition.distractors.map((item) => ({ qid: item.qid, label: item.label, exactPathMatch: false })),
    distractorValidationOutcome: "Passed: all three alternatives are recognizable and plausible in context, but none satisfies both exact relationships in the bounded live query.",
    uniqueIntermediaryCount: 1,
  };
});

const report = {
  batchId: "phase-6c-batch-2", verifiedAt: REVIEWED_AT,
  scope: "Twenty bounded two-edge candidates; graph and Wikidata discovery were treated only as lead sources, and approval required independent current claim, qualifier, supporting-source, Wikipedia-link, uniqueness, prior-registry, and distractor review.",
  counts: { candidates: 20, approved: 18, rejected: 2, priorApproved: 19, cumulativeApproved: 37, remainingTo100: 63, scheduled: 0 },
  rawGraphDiscovery: { file: "content/daily-review-queue.json", resultCount: 50, disposition: "Not promoted. The bounded Neo4j export was dominated by universe and Solidarity generic hubs; all Batch 2 approvals instead passed independent relationship-specific review." },
  candidates: [...approvedAudit, ...rejected],
};
await writeFile(new URL("../content/daily-batch-2-review.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Batch 2 written: ${definitions.length} approved, ${rejected.length} rejected; cumulative approved ${registry.length}; gap ${100 - registry.length}.`);
