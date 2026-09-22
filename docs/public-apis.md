# 健康管理相关公开 API 清单

> 来源:[public-apis/public-apis](https://github.com/public-apis/public-apis)(~448k stars,社区维护的公开 API 大列表)
>
> 本文件从该仓库中挑选了与 `PersonalHealthyManager` 项目相关的 API,按用途分组,供后续接入参考。
>
> 字段说明:
> - **Auth**:鉴权方式(`No` = 无需鉴权,`apiKey` = 需要 API Key,`OAuth` = OAuth 流程)
> - **HTTPS**:是否支持 HTTPS
> - **CORS**:是否支持跨域(`Yes` 可直接在前端/Expo 中调用,`Unknown` 需实测,`No` 需后端代理)

---

## 优先推荐(与项目核心功能强相关)

这几个 API 与"个人健康管理"的功能最契合:饮食营养、运动健身、可穿戴设备数据。

| API | 用途 | Auth | HTTPS | CORS | 接入难度 |
|---|---|---|---|---|---|
| [Nutritionix](https://developer.nutritionix.com/) | 全球最大已验证营养数据库,支持自然语言食物查询 | apiKey | Yes | Unknown | 中 |
| [Edamam](https://developer.edamam.com/) | 食物与营养数据 API,支持食谱搜索、营养分析 | apiKey | Yes | Unknown | 中 |
| [FoodData Central](https://fdc.nal.usda.gov/) | 美国农业部国家营养数据库 | apiKey | Yes | Unknown | 低 |
| [Wger](https://wger.de/en/software/api) | 开源健身动作库(动作、肌肉、器械) | apiKey | Yes | Unknown | 低 |
| [Open Disease (disease.sh)](https://disease.sh/) | COVID-19 和流感等公共健康数据 | No | Yes | Yes | 极低 |
| [Fitbit](https://dev.fitbit.com/) | Fitbit 设备健康数据(步数、心率、睡眠等) | OAuth | Yes | Unknown | 高 |
| [Strava](https://strava.github.io/api/) | 跑步/骑行等活动数据 | OAuth | Yes | Unknown | 高 |
| [Infermedica](https://developer.infermedica.com/docs/) | 基于 NLP 的症状检查与分诊 API | apiKey | Yes | Yes | 中 |

---

## 1. Health(健康)

| API | 描述 | Auth | HTTPS | CORS |
|---|---|:---:|:---:|:---:|
| [Clinical Trials Directory](https://trials.starfile.org/api) | ClinicalTrials.gov 上所有临床试验,按病症和赞助者索引 | No | Yes | Yes |
| [CMS.gov](https://data.cms.gov/provider-data/) | CMS / medicare.gov 数据 | apiKey | Yes | Unknown |
| [Coronavirus](https://pipedream.com/@pravin/http-api-for-latest-wuhan-coronavirus-data-2019-ncov-p_G6CLVM/readme) | 最新 Covid-19 数据 | No | Yes | Unknown |
| [Coronavirus in the UK](https://coronavirus.data.gov.uk/details/developers-guide) | 英国政府新冠数据(分地区病例/死亡) | No | Yes | Unknown |
| [Covid Tracking Project](https://covidtracking.com/data/api/version-2) | 美国 Covid-19 数据 | No | Yes | No |
| [Covid-19](https://covid19api.com/) | Covid-19 传播、感染、恢复 | No | Yes | Yes |
| [Covid-19 (M-Media)](https://github.com/M-Media-Group/Covid-19-API) | 各国病例/死亡/恢复 | No | Yes | Yes |
| [Covid-19 Datenhub](https://npgeo-corona-npgeo-de.hub.arcgis.com) | 德国 COVID-19 地图/数据集 | No | Yes | Unknown |
| [Covid-19 Government Response](https://covidtracker.bsg.ox.ac.uk) | 各国政府应对疫情措施追踪 | No | Yes | Yes |
| [Covid-19 India](https://data.covid19india.org/) | 印度分省/区新冠数据 | No | Yes | Unknown |
| [Covid-19 JHU CSSE](https://nuttaphat.com/covid19-api/) | 基于 JHU CSSE 的新冠数据 | No | Yes | Yes |
| [Covid-19 Live Data](https://github.com/mathdroid/covid-19-api) | 全球及各国每日新冠汇总 | No | Yes | Yes |
| [Covid-19 Philippines](https://github.com/Simperfy/Covid-19-API-Philippines-DOH) | 菲律宾 DOH 新冠数据 | No | Yes | Yes |
| [COVID-19 Tracker Canada](https://api.covid19tracker.ca/docs/1.0/overview) | 加拿大新冠数据 | No | Yes | Unknown |
| [COVID-19 Tracker Sri Lanka](https://www.hpb.health.gov.lk/en/api-documentation) | 斯里兰卡新冠数据 | No | Yes | Unknown |
| [COVID-ID](https://data.covid19.go.id/public/api/prov.json) | 印尼各省新冠数据 | No | Yes | Yes |
| [Cure Cancer With AI](https://www.curecancerwithai.com/developers) | 肿瘤研究、临床试验、FDA 批准、MAMMAL 预测 | apiKey | Yes | No |
| [Dataflow Kit COVID-19](https://covid-19.dataflowkit.com) | COVID-19 实时统计(按小时) | No | Yes | Unknown |
| [Edamam](https://developer.edamam.com/) | 食物与营养数据 API,支持食谱搜索 | apiKey | Yes | Unknown |
| [FoodData Central](https://fdc.nal.usda.gov/) | 美国农业部国家营养数据库 | apiKey | Yes | Unknown |
| [Healthcare.gov](https://www.healthcare.gov/developers/) | 美国健康保险市场教育内容 | No | Yes | Unknown |
| [Humanitarian Data Exchange](https://data.humdata.org/) | 跨危机/组织的人道主义数据开放平台 | No | Yes | Unknown |
| [Infermedica](https://developer.infermedica.com/docs/) | 基于 NLP 的症状检查与分诊 API | apiKey | Yes | Yes |
| [LAPIS](https://cov-spectrum.ethz.ch/public) | SARS-CoV-2 基因组序列数据 | No | Yes | Yes |
| [Lexigram](https://docs.lexigram.io/) | 从文本中提取临床概念的 NLP,临床本体 | apiKey | Yes | Unknown |
| [Longevity World Cup](https://longevityworldcup.com/api/data/athletes) | 公开生物年龄竞赛数据(生物标志物+排名) | No | Yes | Yes |
| [Makeup](http://makeup-api.herokuapp.com/) | 化妆品信息 | No | No | Unknown |
| [MedlinePlus Genetics](https://medlineplus.gov/about/developers/geneticsdatafilesapi/) | 基因/染色体/线粒体 DNA 数据 | No | Yes | Unknown |
| [MyVaccination](https://documenter.getpostman.com/view/16605343/Tzm8GG7u) | 马来西亚疫苗接种数据 | No | Yes | Unknown |
| [NPPES](https://npiregistry.cms.hhs.gov/registry/help-api) | 美国医疗提供者注册信息 | No | Yes | Unknown |
| [Nutritionix](https://developer.nutritionix.com/) | 全球最大已验证营养数据库 | apiKey | Yes | Unknown |
| [Open Data NHS Scotland](https://www.opendata.nhs.scot) | 苏格兰公共卫生医学参考数据与统计 | No | Yes | Unknown |
| [Open Disease](https://disease.sh/) | COVID-19 和流感等当前病例数据 | No | Yes | Yes |
| [openFDA](https://open.fda.gov) | FDA 公开数据(药品/器械/食品) | apiKey | Yes | Unknown |
| [Orion Health](https://developer.orionhealth.io/) | 医疗平台,支持多种医疗场景应用开发 | OAuth | Yes | Unknown |
| [Quarantine](https://quarantine.country/coronavirus/api/) | COVID-19 实时更新 | No | Yes | Yes |

---

## 2. Sports & Fitness(运动与健身)

| API | 描述 | Auth | HTTPS | CORS |
|---|---|:---:|:---:|:---:|
| [API-FOOTBALL](https://www.api-football.com/documentation-v3) | 足球联赛与杯赛信息 | apiKey | Yes | Yes |
| [ApiMedic](https://apimedic.com/) | 面向患者的症状检查器 | apiKey | Yes | Unknown |
| [balldontlie](https://www.balldontlie.io) | NBA 统计数据 | No | Yes | Yes |
| [Canadian Football League (CFL)](http://api.cfl.ca/) | CFL 官方实时联赛/球队/球员统计 | apiKey | Yes | No |
| [City Bikes](https://api.citybik.es/v2/) | 全球共享单车位置 | No | Yes | Unknown |
| [Cloudbet](https://www.cloudbet.com/api/) | 实时体育赔率与下注 API | apiKey | Yes | Yes |
| [CollegeFootballData.com](https://collegefootballdata.com) | 美国大学橄榄球详细统计 | apiKey | Yes | Unknown |
| [DiscGolf](https://discgolfapi.com/docs/) | 飞盘高尔夫球场数据 | No | Yes | Yes |
| [Ergast F1](http://ergast.com/mrd/) | 1950 年起的 F1 数据 | No | Yes | Unknown |
| [Fitbit](https://dev.fitbit.com/) | Fitbit 健康数据 | OAuth | Yes | Unknown |
| [Football](https://rapidapi.com/GiulianoCrescimbeni/api/football98/) | 球队统计、最佳射手等 | X-Mashape-Key | Yes | Unknown |
| [Football (Soccer) Videos](https://www.scorebat.com/video-api/) | 进球与集锦嵌入代码 | No | Yes | Yes |
| [Football Standings](https://github.com/azharimm/football-standings-api) | 足球积分榜(英超、西甲、意甲等) | No | Yes | Yes |
| [Football-Data](https://www.football-data.org) | 足球比赛/球员/球队/赛事数据 | X-Mashape-Key | Yes | Unknown |
| [JCDecaux Bike](https://developer.jcdecaux.com/) | JCDecaux 共享自行车 | apiKey | Yes | Unknown |
| [MLB Records and Stats](https://appac.github.io/mlb-data-api-docs/) | MLB 历史与当前统计 | No | No | Unknown |
| [NBA Data](https://rapidapi.com/api-sports/api/api-nba/) | NBA 全部统计/比分/排名 | apiKey | Yes | Unknown |
| [NBA Stats](https://any-api.com/nba_com/nba_com/docs/API_Description) | NBA 历史与当前统计 | No | Yes | Unknown |
| [NHL Records and Stats](https://gitlab.com/dword4/nhlapi) | NHL 历史数据与统计 | No | Yes | Unknown |
| [Oddsmagnet](https://data.oddsmagnet.com) | 多家英国博彩公司赔率历史 | No | Yes | Yes |
| [OpenF1](https://openf1.org/) | F1 实时与历史数据(圈速、遥测、位置) | No | Yes | Yes |
| [OpenLigaDB](https://www.openligadb.de) | 众包体育联赛结果 | No | Yes | Yes |
| [Padel Snipe](https://padelsnipe.com/fr/world/api) | 9 个欧洲国家 4000+ 板式网球俱乐部 GPS 数据 | No | Yes | Yes |
| [Premier League Standings](https://rapidapi.com/heisenbug/api/premier-league-live-scores/) | 英超实时积分与统计 | apiKey | Yes | Unknown |
| [PropLine](https://prop-line.com) | 实时球员投注赔率与结果 | apiKey | Yes | Unknown |
| [RacingHub](https://racinghub.net/api/v1/docs#/) | F1 历史数据与统计 | No | Yes | Unknown |
| [Sport Data](https://sportdataapi.com) | 全球体育数据 | apiKey | Yes | Unknown |
| [Sport List & Data](https://developers.decathlon.com/products/sports) | 运动项目列表与相关资源 | No | Yes | Yes |
| [Sport Places](https://developers.decathlon.com/products/sport-places) | 众包运动场所(全球) | No | Yes | No |
| [Sport Vision](https://developers.decathlon.com/products/sport-vision) | 图像中识别运动/品牌/装备 | apiKey | Yes | Yes |
| [SportScore](https://sportscore.com/developers/) | 足球/篮球/板球/网球实时比分与统计 | No | Yes | Yes |
| [Sportmonks Cricket](https://docs.sportmonks.com/cricket/) | 板球实时比分/球员统计/梦幻 API | apiKey | Yes | Unknown |
| [Sportmonks Football](https://docs.sportmonks.com/football/) | 足球比分/赛程/新闻/统计/积分 | apiKey | Yes | Unknown |
| [Squiggle](https://api.squiggle.com.au) | 澳式橄榄联赛赛程/结果/预测 | No | Yes | Yes |
| [Strava](https://strava.github.io/api/) | 运动员与活动数据 | OAuth | Yes | Unknown |
| [SuredBits](https://suredbits.com/api/) | 球队/球员/比赛/得分数据查询 | No | No | No |
| [TheRundown](https://therundown.io/) | 实时体育数据(赔率/比分/统计) | apiKey | Yes | Yes |
| [TheSportsDB](https://www.thesportsdb.com/api.php) | 众包体育数据与图片资源 | apiKey | Yes | Yes |
| [TourneyRadar](https://tourneyradar-api.vercel.app) | 140+ 国家国际象棋赛事 | No | Yes | Unknown |
| [Tredict](https://www.tredict.com/blog/oauth_docs/) | 活动与健康数据 | OAuth | Yes | Unknown |
| [Wger](https://wger.de/en/software/api) | 健身动作、肌肉、器械数据 | apiKey | Yes | Unknown |

---

## 3. 周边相关分类

### Food & Drink(饮食)
适合做饮食记录、食谱推荐、卡路里计算。完整列表见原仓库 [Food & Drink](https://github.com/public-apis/public-apis#food--drink) 章节。

### Weather(天气)
可用于结合户外运动建议、空气质量/花粉预警。完整列表见原仓库 [Weather](https://github.com/public-apis/public-apis#weather) 章节。

### Geocoding(地理编码)
可用于跑步路线、附近健身房/公园定位。完整列表见原仓库 [Geocoding](https://github.com/public-apis/public-apis#geocoding) 章节。

### News(新闻)
可拉取健康/医疗类新闻 feed。完整列表见原仓库 [News](https://github.com/public-apis/public-apis#news) 章节。

### Science & Math(科学与数学)
单位换算、BMI/卡路里公式计算等工具类 API。完整列表见原仓库 [Science & Math](https://github.com/public-apis/public-apis#science--math) 章节。

---

## 接入建议(针对 Expo React Native)

### 鉴权策略
- **`No` + CORS `Yes`** 的 API(如 `disease.sh`、`OpenF1`、`City Bikes`):可在 Expo 前端直接 `fetch`,无需后端。
- **`apiKey`** 类 API:不要把 key 硬编码到客户端。建议通过自建后端(本项目 `apps/` 下的服务端)代理,或使用 Expo 的 `EXPO_PUBLIC_*` 环境变量并配合 [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) 存储。
- **`OAuth`** 类 API(Fitbit、Strava):使用 [`expo-auth-session`](https://docs.expo.dev/versions/latest/sdk/auth-session/) 完成 OAuth 流程,token 存入 `expo-secure-store`。

### 优先级建议(按项目阶段)
1. **MVP 阶段**:接入 `disease.sh`(公共健康数据,无需 key,直接 fetch)做首页资讯/数据卡片。
2. **饮食模块**:`Nutritionix` 或 `Edamam`(二选一,看配额与价格),做食物搜索 + 营养信息。
3. **运动模块**:`Wger`(开源,免费)做动作库;后续再加 `Strava`/`Fitbit` 同步。
4. **症状自测**(可选):`Infermedica` 体验最好但有商业授权限制,先评估再接入。

### 注意事项
- **CORS `Unknown`** 的 API 需要在真机/模拟器上实测;Expo 在原生环境下不受 CORS 限制,但 Web 端(`expo web`)会受影响。
- **`HTTPS = No`** 的 API(如 `IUCN`、`MLB Records`、`Makeup`)在 iOS/Android 上默认会被 ATS(App Transport Security)拦截,需额外配置或走后端代理。
- 各 API 的免费配额、调用频率限制会随时间变化,接入前请到对应官网确认最新条款。

---

## 参考链接

- 原始仓库:[public-apis/public-apis](https://github.com/public-apis/public-apis)
- 完整分类索引:见仓库 README 的 [Index](https://github.com/public-apis/public-apis#index) 部分
- 贡献指南:[CONTRIBUTING.md](https://github.com/public-apis/public-apis/blob/master/CONTRIBUTING.md)
- 维护方:[APILayer](https://apilayer.com/)
- 社区:Discord 服务器(见仓库 README)
