"""data/seed.json faylini yaratadi: bo'limlar, 12 qism (uz/ru/en), tariflar, sozlamalar.
Ishga tushirish: python3 tools/make_seed.py  (manba: tools/episodes_uz.json)"""
import json, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'episodes_uz.json')))

TITLES = {
    1: ("Привет — начало вежливости", "A Greeting Starts Good Manners"),
    2: ("Встаём рано!", "Rise and Shine!"),
    3: ("Вода — это жизнь", "Water Is Life"),
    4: ("Бабушкины лепёшки", "Grandma's Bread"),
    5: ("Считаем воробьёв", "Counting Sparrows"),
    6: ("Сладкий сон", "Sweet Dreams"),
    7: ("Сравниваем на базаре", "Comparing at the Bazaar"),
    8: ("Самса — треугольник", "Somsa Is a Triangle"),
    9: ("Цвета атласа", "Colors of Atlas Silk"),
    10: ("Чистые руки", "Clean Hands"),
    11: ("Делим яблоки", "Sharing Apples"),
    12: ("Светофор — наш друг", "The Traffic Light Is Our Friend"),
}
SHIOR = {
    1: ("Здоровайтесь со старшими!", "Greet your elders!"),
    2: ("Начинаем день по порядку!", "Let's start the day in order!"),
    3: ("Вода — это жизнь, берегите её!", "Water is life — let's save it!"),
    4: ("Бережём хлеб!", "We treasure bread!"),
    5: ("Заботимся о птицах!", "We care for birds!"),
    6: ("Рано ложишься — рано встаёшь!", "Early to bed, early to rise!"),
    7: ("Уважай старших, береги младших!", "Respect elders, care for the little ones!"),
    8: ("Оглянись — найди фигуру!", "Look around — find the shape!"),
    9: ("Разноцветный мир — красивый мир!", "A colorful world is a beautiful world!"),
    10: ("Чистые руки — здоровый ребёнок!", "Clean hands, healthy kids!"),
    11: ("Делиться поровну — знак дружбы!", "Sharing equally is a sign of friendship!"),
    12: ("На дороге будь осторожен — смотри на светофор!", "Be careful on the road — watch the traffic light!"),
}
GOAL = {
    1: ("Первым здороваться со старшим, приложив руку к груди. Правило: младший приветствует старшего, идущий — сидящего.",
        "Greet an elder first, with a hand on the chest. Rule: the younger greets the older, the one walking greets the one sitting."),
    2: ("Выполнять 5 утренних шагов по порядку: встать и заправить постель, умыться, почистить зубы, зарядка, завтрак. Дополнительно: счёт от 1 до 5.",
        "Do the 5 morning steps in order: get up and make the bed, wash, brush teeth, exercise, have breakfast. Extra: counting from 1 to 5."),
    3: ("Пить чистую воду, когда хочется пить, сидя и маленькими глотками; не тратить воду зря (закрывать кран).",
        "Drink clean water when thirsty, sitting down and in small sips; don't waste water (turn off the tap)."),
    4: ("Счёт от 1 до 5 и сложение в пределах 5: 2 + 1 = 3, 3 + 2 = 5. Воспитательная цель: бережное отношение к хлебу.",
        "Counting from 1 to 5 and adding within 5: 2 + 1 = 3, 3 + 2 = 5. Values: treating bread with respect."),
    5: ("Вычитание в пределах 5: 5 − 2 = 3, 3 − 1 = 2; значение слова «осталось». Воспитательная цель: не пугать птиц, оставлять им корм и воду.",
        "Subtracting within 5: 5 − 2 = 3, 3 − 1 = 2; the meaning of “left”. Values: not scaring birds, leaving them grain and water."),
    6: ("Вечерний распорядок: собрать игрушки, почистить зубы, отложить телефон перед сном, рано лечь спать. Дополнительно: счёт до 4.",
        "Evening routine: tidy up toys, brush teeth, put the phone away before bed, go to bed early. Extra: counting to 4."),
    7: ("Сравнивать предметы по величине (большой–маленький) и количеству (много–мало); счёт до 5.",
        "Compare objects by size (big–small) and amount (more–fewer); counting to 5."),
    8: ("Узнавать круг, треугольник и прямоугольник; считать их стороны.",
        "Recognize a circle, a triangle and a rectangle; count their sides."),
    9: ("Узнавать и называть четыре цвета (красный, жёлтый, зелёный, синий); знакомство с национальной тканью — атласом.",
        "Recognize and name four colors (red, yellow, green, blue); meet the national fabric — atlas silk."),
    10: ("Мыть руки с мылом перед едой: намочить, намылить и вспенить, смыть, вытереть; счёт до 10.",
         "Wash hands with soap before eating: wet, soap and lather, rinse, dry; counting to 10."),
    11: ("Делить 4 предмета поровну на двоих, «по одному»; дружба и справедливость.",
         "Share 4 things equally between two, “one each”; friendship and fairness."),
    12: ("Сигналы светофора (красный — стой, жёлтый — жди, зелёный — можно идти); переходить дорогу по пешеходному переходу, держась за руку взрослого.",
         "Traffic light signals (red — stop, yellow — wait, green — go); cross the road at the crosswalk, holding an adult's hand."),
}
QS = {
    1: (["Почему Бобур остановился?", "Куда кладут руку, когда здороваются?", "Кто здоровается первым: младший или старший?"],
        ["Why did Bobur stop?", "Where do we put our hand when we greet?", "Who greets first: the younger or the older?"]),
    2: (["Что мы делаем утром в первую очередь?", "Как мы чистим зубы?"], ["What do we do first in the morning?", "How do we brush our teeth?"]),
    3: (["Почему завял цветок?", "Что мы пьём, когда хочется пить?", "Что будет, если кран останется открытым?"],
        ["Why did the flower wilt?", "What do we drink when we are thirsty?", "What happens if the tap is left open?"]),
    4: (["Сколько лепёшек стало в корзине?", "Что мы делаем, если хлеб упал на землю?"], ["How many breads are in the basket now?", "What do we do if bread falls on the ground?"]),
    5: (["Сколько воробьёв осталось на ветке?", "Как мы заботимся о птицах?"], ["How many sparrows are left on the branch?", "How do we take care of birds?"]),
    6: (["Что мы делаем перед сном?", "Почему телефон тоже «спит»?"], ["What do we do before bed?", "Why does the phone “sleep” too?"]),
    7: (["Какая дыня больше?", "На какой тарелке больше яблок?", "Что мы говорим продавцу на базаре?"],
        ["Which melon is bigger?", "Which plate has more apples?", "What do we say to the seller at the bazaar?"]),
    8: (["Сколько сторон у самсы?", "Какие предметы в комнате круглые?"], ["How many sides does a somsa have?", "Which things in the room are round?"]),
    9: (["Какого цвета яблоко?", "Какие цвета вы увидели на атласе?"], ["What color is the apple?", "Which colors did you see on the atlas silk?"]),
    10: (["Чем мы моем руки?", "Когда мы моем руки?"], ["What do we wash our hands with?", "When do we wash our hands?"]),
    11: (["Сколько яблок Бобур сначала хотел взять?", "Сколько яблок досталось каждому?", "Почему Бобур попросил прощения?"],
         ["How many apples did Bobur want to take at first?", "How many apples did each one get?", "Why did Bobur say sorry?"]),
    12: (["Что мы делаем, когда горит красный свет?", "С кем мы переходим дорогу?"], ["What do we do when the light is red?", "Who do we cross the road with?"]),
}
ACT = {
    1: ("Дети играют в приветствие парами.", "Children play a greeting game in pairs."),
    2: ("Разложить 5 картинок в порядке утреннего распорядка.", "Put 5 pictures in the order of the morning routine."),
    3: ("У умывальника потренироваться открывать и закрывать кран; выпить стакан воды сидя, маленькими глотками.",
        "Practice turning the tap on and off at the washstand; drink a glass of water sitting down, in small sips."),
    4: ("Выполнить 2 + 1 и 3 + 2 с настоящими предметами (ложки, кубики, игрушечный хлеб).", "Do 2 + 1 and 3 + 2 with real objects (spoons, blocks, toy bread)."),
    5: ("Пальчиковая игра: «5 пальцев — 2 загни — сколько осталось?»", "Finger game: “5 fingers — fold 2 — how many are left?”"),
    6: ("Составить последовательность по картинкам: игрушки → зубы → колыбельная → сон.", "Make a picture sequence: toys → teeth → lullaby → sleep."),
    7: ("Положить на две тарелки разное количество фруктов или кубиков и сравнить «много–мало», «большой–маленький».",
        "Put different numbers of fruits or blocks on two plates and compare “more–fewer”, “big–small”."),
    8: ("Охота за фигурами: найти в комнате круглые, треугольные и прямоугольные предметы.", "Shape hunt: find round, triangular and rectangular things in the room."),
    9: ("Охота за цветами: найти предметы четырёх цветов и разложить их по цвету.", "Color hunt: find things in four colors and sort them by color."),
    10: ("Вместе вымыть руки у умывальника, считая до 10.", "Wash hands together at the washstand, counting to 10."),
    11: ("Разделить 4, а затем 6 кубиков между двумя куклами по одному.", "Share 4 and then 6 blocks between two dolls, one each."),
    12: ("Ролевая игра с бумажным светофором.", "Role play with a paper traffic light."),
}
CATS = {
    "odob": {"uz": "Odob", "ru": "Этикет", "en": "Manners", "color": "#E07A5F"},
    "kun": {"uz": "Kun tartibi", "ru": "Режим дня", "en": "Daily routine", "color": "#3D8BB8"},
    "salomat": {"uz": "Salomatlik", "ru": "Здоровье", "en": "Health", "color": "#2A9D8F"},
    "math": {"uz": "Matematika", "ru": "Математика", "en": "Math", "color": "#8E6CC7"},
    "bilim": {"uz": "Bilim", "ru": "Знания", "en": "Knowledge", "color": "#E9A23B"},
    "xavf": {"uz": "Xavfsizlik", "ru": "Безопасность", "en": "Safety", "color": "#D1495B"},
}
# Boshlang'ich kirish turi (admin o'zgartiradi): 1–4 hamma uchun bepul, 5–8 ro'yxatdan o'tganlarga, 9–12 pullik
def access_for(n):
    return ("free", 0) if n <= 4 else (("login", 0) if n <= 8 else ("paid", 10))

videos = []
for e in L:
    n = e["n"]; acc, price = access_for(n)
    sources = {"uz": f"videos/uz/ep{n:02d}.mp4"}
    for lg in ("ru", "en"):
        if os.path.exists(os.path.join(ROOT, "videos", lg, f"ep{n:02d}.mp4")):
            sources[lg] = f"videos/{lg}/ep{n:02d}.mp4"
    videos.append({
        "id": f"ob-{n:02d}", "sectionId": "odobli-bolajonlar", "order": n, "published": True,
        "title": {"uz": e["t"], "ru": TITLES[n][0], "en": TITLES[n][1]},
        "desc": {"uz": e["goal"], "ru": GOAL[n][0], "en": GOAL[n][1]},
        "slogan": {"uz": e["shior"], "ru": SHIOR[n][0], "en": SHIOR[n][1]},
        "questions": {"uz": e["qs"], "ru": QS[n][0], "en": QS[n][1]},
        "activity": {"uz": e["act"], "ru": ACT[n][0], "en": ACT[n][1]},
        "words": e.get("words", []),
        "cat": e["cat"], "age": e["age"], "duration": e["dur"],
        "poster": f"assets/posters/ep{n:02d}.jpg",
        "access": acc, "price": price, "sources": sources,
    })
# 3-qism maqsadiga «o'tirib ichish» qo'shildi (yangi sahna)
videos[2]["desc"]["uz"] = "Chanqaganda toza suvni o‘tirib, qultumlab ichish va suvni isrof qilmaslik (jo‘mrakni berkitish)."

seed = {
    # yangi til fayli qo‘shilsa versiya o‘zi oshadi — demo rejimdagi brauzerlar yangi manbalarni oladi
    "version": 2 + sum(len(v["sources"]) - 1 for v in videos),
    "settings": {
        "siteName": {"uz": "Odobli bolajonlar", "ru": "Вежливые детки", "en": "Polite Little Kids"},
        "welcomeBonus": 20, "parentGate": True, "autoplayNext": False, "defaultLang": "uz",
        "currencyName": {"uz": "bilim", "ru": "билим", "en": "bilim"},
        "contactPhone": "", "contactEmail": "", "contactTelegram": "",
        "announcement": {"on": False, "uz": "", "ru": "", "en": ""},
        "maintenance": False,
        "hero": {
            "title": {"uz": "Kichkintoylar uchun odob va bilim", "ru": "Вежливость и знания для малышей", "en": "Manners and learning for little ones"},
            "subtitle": {"uz": "3–7 yoshli bolalar uchun qisqa, xotirjam va milliy qadriyatlarga asoslangan multfilmlar. Har bir qismda bitta foydali saboq.",
                         "ru": "Короткие спокойные мультфильмы для детей 3–7 лет, основанные на национальных ценностях. В каждой серии — один полезный урок.",
                         "en": "Short, calm cartoons for children aged 3–7, rooted in Uzbek national values. One useful lesson in every episode."},
            "videoId": "ob-01"},
        "blocks": [
            {"id": "continue", "type": "continue", "visible": True},
            {"id": "sec-odobli", "type": "section", "sectionId": "odobli-bolajonlar", "visible": True},
            {"id": "tariffs", "type": "tariffs", "visible": True},
            {"id": "parents", "type": "parents", "visible": True},
        ],
    },
    "categories": CATS,
    "sections": [
        {"id": "odobli-bolajonlar", "order": 1, "visible": True, "color": "#2A9D8F", "cover": "assets/img/hero.jpg",
         "title": {"uz": "Odobli bolajonlar", "ru": "Вежливые детки", "en": "Polite Little Kids"},
         "desc": {"uz": "12 qismli turkum: odob, kun tartibi, salomatlik, sanash, shakl va ranglar.",
                  "ru": "Сериал из 12 серий: этикет, режим дня, здоровье, счёт, фигуры и цвета.",
                  "en": "A 12-episode series: manners, daily routine, health, counting, shapes and colors."}},
    ],
    "videos": videos,
    "tariffs": [
        {"id": "pkg-50", "type": "package", "order": 1, "active": True, "bilim": 50, "bonus": 0, "priceUZS": 10000,
         "name": {"uz": "Boshlang‘ich", "ru": "Стартовый", "en": "Starter"}},
        {"id": "pkg-120", "type": "package", "order": 2, "active": True, "bilim": 100, "bonus": 20, "priceUZS": 20000,
         "name": {"uz": "Oilaviy", "ru": "Семейный", "en": "Family"}},
        {"id": "pkg-300", "type": "package", "order": 3, "active": True, "bilim": 250, "bonus": 50, "priceUZS": 45000,
         "name": {"uz": "Katta", "ru": "Большой", "en": "Large"}},
        {"id": "sub-30", "type": "subscription", "order": 4, "active": True, "bilim": 60, "days": 30,
         "name": {"uz": "Oylik obuna", "ru": "Подписка на месяц", "en": "Monthly pass"}},
        {"id": "sub-365", "type": "subscription", "order": 5, "active": True, "bilim": 500, "days": 365,
         "name": {"uz": "Yillik obuna", "ru": "Годовая подписка", "en": "Yearly pass"}},
    ],
}
out = os.path.join(ROOT, "data", "seed.json")
json.dump(seed, open(out, "w"), ensure_ascii=False, indent=1)
print("seed:", len(videos), "videos ->", out)
