import type { Meta, StoryObj } from '@storybook/react-vite';
import { ColorPalette } from './color-palette';

const meta = {
  title: 'Dev/ColorPalette',
  component: ColorPalette,
  argTypes: {
    color: { control: 'color' },
    text: { control: 'text' },
    textColor: { control: 'color' },
  },
} satisfies Meta<typeof ColorPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** White — collides with the light-theme background. */
export const White: Story = {
  args: { color: '#FFFFFF' },
};

/** Black — collides with the dark-theme background. */
export const Black: Story = {
  args: { color: '#000000' },
};

/** Blue — a well-contrasted brand-style color against both themes. */
export const Blue: Story = {
  args: { color: '#1976D2' },
};

/** Three baseline colors side by side so the low-contrast result is easy to compare. */
export const WhiteBlackBlue: Story = {
  args: { color: '#FFFFFF' },
  render: () => (
    <div className="flex flex-col gap-2">
      <ColorPalette color="#FFFFFF" textColor="#000000" />
      <ColorPalette color="#000000" textColor="#FFFFFF" />
      <ColorPalette color="#1976D2" textColor="#FFFFFF" />
    </div>
  ),
};

/**
 * Every Toei Bus (都営バス) route_color / route_text_color pair from
 * the minkuru dataset, sorted by `route_id`. Sampled from
 * `public/data-v2/minkuru/data.json` at the time of authoring.
 * Refresh via a repository script when the source data is updated.
 */
const MINKURU_ROUTES = [
  { id: 'minkuru:002', color: '#F1B34E', textColor: '#350800', shortName: '波０１(ＮＭ０１)' },
  { id: 'minkuru:003', color: '#B779B7', textColor: '#FAF6FB', shortName: '市０１' },
  { id: 'minkuru:006', color: '#00A9E8', textColor: '#FFFFFF', shortName: '都０１(Ｔ０１)' },
  { id: 'minkuru:008', color: '#BB7AAA', textColor: '#FFFFFF', shortName: 'ＲＨ０１' },
  { id: 'minkuru:010', color: '#E90087', textColor: '#FFF0FF', shortName: 'ＣＨ０１' },
  { id: 'minkuru:015', color: '#1DA366', textColor: '#FFFFFF', shortName: '江東０１' },
  { id: 'minkuru:017', color: '#EC9288', textColor: '#FFFFFF', shortName: '豊洲０１' },
  { id: 'minkuru:018', color: '#D0086E', textColor: '#FFFFFF', shortName: '海０１(ＫＭ０１)' },
  { id: 'minkuru:019', color: '#6653A8', textColor: '#FFFFFF', shortName: '学０２' },
  { id: 'minkuru:020', color: '#B071B6', textColor: '#FFFFFF', shortName: '都０２' },
  { id: 'minkuru:021', color: '#4986BC', textColor: '#FFFFFF', shortName: '都０２乙' },
  { id: 'minkuru:023', color: '#8878C1', textColor: '#FFFFFF', shortName: '都０３' },
  { id: 'minkuru:024', color: '#5AC17C', textColor: '#FFFFFF', shortName: '学０３' },
  { id: 'minkuru:026', color: '#29B369', textColor: '#FFFFFF', shortName: '都０４' },
  { id: 'minkuru:027', color: '#4A81BA', textColor: '#FFFFFF', shortName: '学０５' },
  { id: 'minkuru:028', color: '#B9569F', textColor: '#FFFFFF', shortName: '急行０５' },
  { id: 'minkuru:031', color: '#8B3F8C', textColor: '#FFFFFF', shortName: '都０６' },
  { id: 'minkuru:032', color: '#F7BF10', textColor: '#2A1000', shortName: '学０６' },
  { id: 'minkuru:033', color: '#0AB16C', textColor: '#FFFFFF', shortName: '急行０６' },
  { id: 'minkuru:036', color: '#0B963C', textColor: '#FFFFFF', shortName: '都０７' },
  { id: 'minkuru:038', color: '#006AB5', textColor: '#FFFFFF', shortName: '都０８(Ｔ０８)' },
  { id: 'minkuru:040', color: '#00ADF3', textColor: '#FFFFFF', shortName: '業１０' },
  { id: 'minkuru:041', color: '#00ADF3', textColor: '#FFFFFF', shortName: '業１０出入' },
  { id: 'minkuru:044', color: '#FCB03E', textColor: '#280600', shortName: '錦１１' },
  { id: 'minkuru:045', color: '#C69460', textColor: '#FFFFFF', shortName: '木１１甲' },
  { id: 'minkuru:046', color: '#F33825', textColor: '#FFFFFF', shortName: '錦１３' },
  { id: 'minkuru:047', color: '#F33825', textColor: '#FFFFFF', shortName: '錦１３出入' },
  { id: 'minkuru:049', color: '#B8ADD4', textColor: '#FFFFFF', shortName: '東１５' },
  { id: 'minkuru:050', color: '#C88243', textColor: '#FFFFFF', shortName: '東１６' },
  { id: 'minkuru:051', color: '#F4A143', textColor: '#FFFFFF', shortName: '錦１８' },
  { id: 'minkuru:052', color: '#9EB94D', textColor: '#FFFFFF', shortName: '門１９' },
  { id: 'minkuru:053', color: '#887AB5', textColor: '#FFFFFF', shortName: '陽２０' },
  { id: 'minkuru:055', color: '#EFB23A', textColor: '#FFFFFF', shortName: '新小２０' },
  { id: 'minkuru:056', color: '#10A152', textColor: '#FFFFFF', shortName: '西葛２０甲' },
  { id: 'minkuru:057', color: '#C19460', textColor: '#FFFFFF', shortName: '西葛２０乙' },
  { id: 'minkuru:058', color: '#FBCC4A', textColor: '#271100', shortName: '亀２１' },
  { id: 'minkuru:059', color: '#13AE65', textColor: '#FFFFFF', shortName: '門２１' },
  { id: 'minkuru:060', color: '#DC0144', textColor: '#FFFFFF', shortName: '新小２１' },
  { id: 'minkuru:061', color: '#79A5D9', textColor: '#FFFFFF', shortName: '葛西２１' },
  { id: 'minkuru:062', color: '#4B8D7B', textColor: '#FFFFFF', shortName: '里２２' },
  { id: 'minkuru:063', color: '#466E96', textColor: '#FFFFFF', shortName: '東２２' },
  { id: 'minkuru:066', color: '#F45D3A', textColor: '#FFFFFF', shortName: '葛西２２' },
  { id: 'minkuru:067', color: '#F5AC44', textColor: '#FFFFFF', shortName: '臨海２２' },
  { id: 'minkuru:068', color: '#3D9B80', textColor: '#FFFFFF', shortName: '新小２２' },
  { id: 'minkuru:070', color: '#99B1DD', textColor: '#FFFFFF', shortName: '上２３' },
  { id: 'minkuru:071', color: '#99B1DD', textColor: '#FFFFFF', shortName: '上２３出入' },
  { id: 'minkuru:072', color: '#3F86C2', textColor: '#FFFFFF', shortName: '亀２３' },
  { id: 'minkuru:073', color: '#95B2B6', textColor: '#FFFFFF', shortName: '平２３' },
  { id: 'minkuru:074', color: '#14A862', textColor: '#FFFFFF', shortName: '草２４' },
  { id: 'minkuru:075', color: '#96C528', textColor: '#FFFFFF', shortName: '亀２４' },
  { id: 'minkuru:076', color: '#367CBD', textColor: '#FFFFFF', shortName: '葛西２４' },
  { id: 'minkuru:077', color: '#E08673', textColor: '#FFFFFF', shortName: '錦２５出入' },
  { id: 'minkuru:078', color: '#E08673', textColor: '#FFFFFF', shortName: '錦２５' },
  { id: 'minkuru:079', color: '#E860A0', textColor: '#FFFFFF', shortName: '上２６' },
  { id: 'minkuru:080', color: '#AAD14E', textColor: '#FFFFFF', shortName: '西葛２６' },
  { id: 'minkuru:081', color: '#D79B47', textColor: '#FFFFFF', shortName: '秋２６' },
  { id: 'minkuru:082', color: '#8979C7', textColor: '#FFFFFF', shortName: '亀２６' },
  { id: 'minkuru:083', color: '#0EAD66', textColor: '#FFFFFF', shortName: '錦２７' },
  { id: 'minkuru:084', color: '#E26099', textColor: '#FFFFFF', shortName: '錦２７-２' },
  { id: 'minkuru:085', color: '#4386C1', textColor: '#FFFFFF', shortName: '西葛２７' },
  { id: 'minkuru:086', color: '#DE6F9E', textColor: '#FFFFFF', shortName: '平２８' },
  { id: 'minkuru:087', color: '#1BA5EA', textColor: '#FFFFFF', shortName: '両２８' },
  { id: 'minkuru:088', color: '#6E9F8E', textColor: '#FFFFFF', shortName: '船２８' },
  { id: 'minkuru:089', color: '#EC96BB', textColor: '#FFFFFF', shortName: '錦２８' },
  { id: 'minkuru:091', color: '#AB558D', textColor: '#FFFFFF', shortName: '新小２９' },
  { id: 'minkuru:092', color: '#DD5E97', textColor: '#FFFFFF', shortName: '亀２９' },
  { id: 'minkuru:093', color: '#B27B5A', textColor: '#FFFFFF', shortName: '門３３' },
  { id: 'minkuru:094', color: '#32B36B', textColor: '#FFFFFF', shortName: '錦３７' },
  { id: 'minkuru:096', color: '#B5CF6D', textColor: '#000000', shortName: '草３９' },
  { id: 'minkuru:097', color: '#F6C543', textColor: '#2C1000', shortName: '王４０丙' },
  { id: 'minkuru:098', color: '#85A400', textColor: '#FFFFFF', shortName: '王４０出入' },
  { id: 'minkuru:099', color: '#85A400', textColor: '#FFFFFF', shortName: '王４０甲' },
  { id: 'minkuru:100', color: '#00A9E2', textColor: '#FFFFFF', shortName: '王４１' },
  { id: 'minkuru:101', color: '#C5D188', textColor: '#0B0903', shortName: '草４１' },
  { id: 'minkuru:102', color: '#F4C60E', textColor: '#230500', shortName: '東４２-１' },
  { id: 'minkuru:103', color: '#9C9977', textColor: '#FFFFFF', shortName: '東４２-３' },
  { id: 'minkuru:105', color: '#BE8855', textColor: '#FFFFFF', shortName: '東４３' },
  { id: 'minkuru:106', color: '#B35999', textColor: '#FFFFFF', shortName: '草４３' },
  { id: 'minkuru:107', color: '#1EAA6A', textColor: '#FFFFFF', shortName: '端４４' },
  { id: 'minkuru:108', color: '#F8C01D', textColor: '#250900', shortName: '王４５' },
  { id: 'minkuru:109', color: '#F18C2C', textColor: '#FFFFFF', shortName: '上４６' },
  { id: 'minkuru:110', color: '#FFDB82', textColor: '#260A00', shortName: '北４７' },
  { id: 'minkuru:112', color: '#FDAF4C', textColor: '#000000', shortName: '里４８' },
  { id: 'minkuru:116', color: '#A5C701', textColor: '#FFFFFF', shortName: '王４９' },
  { id: 'minkuru:117', color: '#B1D25D', textColor: '#061D00', shortName: '茶５１' },
  { id: 'minkuru:118', color: '#BB85B1', textColor: '#FFFFFF', shortName: '王５５' },
  { id: 'minkuru:119', color: '#267B6B', textColor: '#FFFFFF', shortName: '王５７' },
  { id: 'minkuru:120', color: '#227AB7', textColor: '#FFFFFF', shortName: '上５８' },
  { id: 'minkuru:121', color: '#F7A341', textColor: '#FFFFFF', shortName: '上６０' },
  { id: 'minkuru:122', color: '#960085', textColor: '#FFFFFF', shortName: '白６１' },
  { id: 'minkuru:124', color: '#FBCC35', textColor: '#2A1200', shortName: '飯６２' },
  { id: 'minkuru:125', color: '#77A797', textColor: '#FFFFFF', shortName: '橋６３' },
  { id: 'minkuru:126', color: '#DF361C', textColor: '#FFFFFF', shortName: '草６３' },
  { id: 'minkuru:127', color: '#0B9C4F', textColor: '#FFFFFF', shortName: '飯６４' },
  { id: 'minkuru:128', color: '#3D83CF', textColor: '#FFFFFF', shortName: '草６４' },
  { id: 'minkuru:129', color: '#008A3D', textColor: '#FFFFFF', shortName: '池６５' },
  { id: 'minkuru:130', color: '#A0C322', textColor: '#FFFFFF', shortName: '渋６６' },
  { id: 'minkuru:131', color: '#83C667', textColor: '#FFFFFF', shortName: '上６９' },
  { id: 'minkuru:133', color: '#769DBA', textColor: '#FFFFFF', shortName: '高７１' },
  { id: 'minkuru:135', color: '#02A051', textColor: '#FFFFFF', shortName: '宿７４' },
  { id: 'minkuru:138', color: '#91A48D', textColor: '#FFFFFF', shortName: '宿７５' },
  { id: 'minkuru:141', color: '#F8A23E', textColor: '#FFFFFF', shortName: '黒７７' },
  { id: 'minkuru:147', color: '#DB3616', textColor: '#FFFFFF', shortName: '早７７' },
  { id: 'minkuru:148', color: '#728FB2', textColor: '#FFFFFF', shortName: '王７８' },
  { id: 'minkuru:149', color: '#F35D9C', textColor: '#FFFFFF', shortName: '早８１' },
  { id: 'minkuru:151', color: '#0CB46B', textColor: '#FFFFFF', shortName: '橋８６' },
  { id: 'minkuru:152', color: '#EB8F2B', textColor: '#FFFFFF', shortName: '池８６' },
  { id: 'minkuru:153', color: '#DD027F', textColor: '#FFFFFF', shortName: '田８７' },
  { id: 'minkuru:154', color: '#D67B60', textColor: '#FFFFFF', shortName: '渋８８' },
  { id: 'minkuru:157', color: '#EE3519', textColor: '#FFFFFF', shortName: '品９１' },
  { id: 'minkuru:158', color: '#63C07A', textColor: '#FFFFFF', shortName: '宿９１' },
  { id: 'minkuru:159', color: '#6F91C0', textColor: '#FFFFFF', shortName: '田９２' },
  { id: 'minkuru:160', color: '#029148', textColor: '#FFFFFF', shortName: '井９２' },
  { id: 'minkuru:161', color: '#00AEEC', textColor: '#FFFFFF', shortName: '品９３' },
  { id: 'minkuru:162', color: '#F1B64B', textColor: '#351706', shortName: '反９４' },
  { id: 'minkuru:163', color: '#FBDA49', textColor: '#35161B', shortName: '浜９５' },
  { id: 'minkuru:165', color: '#963F3C', textColor: '#FFFFFF', shortName: '品９６' },
  { id: 'minkuru:166', color: '#E5628A', textColor: '#FFFFFF', shortName: '反９６' },
  { id: 'minkuru:167', color: '#AB5296', textColor: '#FFFFFF', shortName: '井９６' },
  { id: 'minkuru:169', color: '#B1D25F', textColor: '#000000', shortName: '品９７' },
  { id: 'minkuru:170', color: '#34AE70', textColor: '#FFFFFF', shortName: '品９８' },
  { id: 'minkuru:172', color: '#FFE16B', textColor: '#231D00', shortName: '井９８' },
  { id: 'minkuru:173', color: '#0158B2', textColor: '#FFFFFF', shortName: '品９９' },
  { id: 'minkuru:174', color: '#76A696', textColor: '#FFFFFF', shortName: '田９９' },
  { id: 'minkuru:175', color: '#E37B57', textColor: '#FFFFFF', shortName: '臨海２８-１' },
  { id: 'minkuru:176', color: '#71C28B', textColor: '#FFFFFF', shortName: '臨海２８-２' },
  { id: 'minkuru:177', color: '#7E72A0', textColor: '#FFFFFF', shortName: '錦４０' },
  { id: 'minkuru:181', color: '#FBC303', textColor: '#370E00', shortName: '都０５-２' },
  { id: 'minkuru:183', color: '#FBC303', textColor: '#370E00', shortName: '都０５-１出入' },
  { id: 'minkuru:184', color: '#FBC303', textColor: '#370E00', shortName: '都０５-１' },
  { id: 'minkuru:185', color: '#EA902A', textColor: '#FFFFFF', shortName: '池８６出入' },
  { id: 'minkuru:188', color: '#A1ABB3', textColor: '#FFFFFF', shortName: '直行０３' },
  { id: 'minkuru:190', color: '#F1AAC8', textColor: '#3D0319', shortName: '陽１２-１' },
  { id: 'minkuru:191', color: '#8AB81F', textColor: '#FFFFFF', shortName: '陽１２-２' },
  { id: 'minkuru:193', color: '#A9A6D6', textColor: '#FFFFFF', shortName: '練６８' },
  { id: 'minkuru:194', color: '#F47691', textColor: '#FFFFFF', shortName: '臨海２８-３' },
  { id: 'minkuru:195', color: '#FDC404', textColor: '#240700', shortName: '東４２-２' },
  { id: 'minkuru:196', color: '#E65A85', textColor: '#FFFFFF', shortName: '里４８-２' },
  { id: 'minkuru:198', color: '#0CB168', textColor: '#FFFFFF', shortName: '上０１' },
  { id: 'minkuru:199', color: '#88A484', textColor: '#FFFFFF', shortName: '茶０７' },
  { id: 'minkuru:280', color: '#00933D', textColor: '#FFFFFF', shortName: '梅７０' },
  { id: 'minkuru:281', color: '#078DC0', textColor: '#FFFFFF', shortName: '梅７４甲' },
  { id: 'minkuru:282', color: '#F07A54', textColor: '#FFFFFF', shortName: '梅７４乙' },
  { id: 'minkuru:283', color: '#BC8D7D', textColor: '#FFFFFF', shortName: '梅７６甲' },
  { id: 'minkuru:285', color: '#E60174', textColor: '#FFFFFF', shortName: '梅７６丙' },
  { id: 'minkuru:286', color: '#77BC2D', textColor: '#FFFFFF', shortName: '梅７７甲' },
  { id: 'minkuru:287', color: '#8649A7', textColor: '#FFFFFF', shortName: '梅７７乙' },
  { id: 'minkuru:288', color: '#B08B5B', textColor: '#FFFFFF', shortName: '梅７７丙' },
  { id: 'minkuru:289', color: '#EB6C78', textColor: '#FFFFFF', shortName: '梅７７丁' },
  { id: 'minkuru:291', color: '#7B6FAE', textColor: '#FFFFFF', shortName: '梅０１' },
] as const;

/**
 * All Toei Bus (都営バス) routes rendered as a column so the
 * production route_color / route_text_color pairs and the
 * low-contrast classification can be compared side by side.
 */
export const MinkuruRouteColor: Story = {
  args: { color: '#F1B34E', text: '波０１（ＮＭ０１）', textColor: '#350800' },
  render: () => (
    <div className="flex flex-col gap-2">
      {MINKURU_ROUTES.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          [<span className="font-mono text-xs">{s.id}</span>
          <span className="font-mono text-xs">{s.color}</span>
          <span className="font-mono text-xs">{s.textColor}</span>
          ]
          <ColorPalette color={s.color} text={s.shortName} textColor={s.textColor} />
        </div>
      ))}
    </div>
  ),
};

/**
 * Every Kyoto City Bus (京都市バス) route_color / route_text_color
 * pair from the kcbus dataset, sorted by `route_id`. Notable for the
 * large population of `#000000` route_color values that collide with
 * the dark-theme background.
 */
const KC_ROUTES = [
  { id: 'kcbus:00100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１' },
  { id: 'kcbus:00302', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス上終町３' },
  { id: 'kcbus:003A0', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス３' },
  { id: 'kcbus:00400', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス４' },
  { id: 'kcbus:00403', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス松ヶ崎４' },
  { id: 'kcbus:00404', color: '#ADD8E6', textColor: '#000000', shortName: 'かわらまち・よるバス' },
  { id: 'kcbus:00500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス５' },
  { id: 'kcbus:00503', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス五条通５' },
  { id: 'kcbus:00525', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス快速５' },
  { id: 'kcbus:00600', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス６' },
  { id: 'kcbus:00684', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス快速６' },
  { id: 'kcbus:00700', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス７' },
  { id: 'kcbus:00800', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス８' },
  { id: 'kcbus:00803', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス特８' },
  { id: 'kcbus:00900', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス９' },
  { id: 'kcbus:00985', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス快速９' },
  { id: 'kcbus:01000', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１０' },
  { id: 'kcbus:01100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１１' },
  { id: 'kcbus:01200', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１２' },
  { id: 'kcbus:01300', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１３' },
  { id: 'kcbus:01303', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス特１３' },
  { id: 'kcbus:01500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１５' },
  { id: 'kcbus:01595', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス快速１５' },
  { id: 'kcbus:01600', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１６' },
  { id: 'kcbus:01800', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１８' },
  { id: 'kcbus:01803', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス特１８' },
  { id: 'kcbus:01804', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス竹田駅１８' },
  { id: 'kcbus:01900', color: '#000000', textColor: '#FFFFFF', shortName: '市バス１９' },
  { id: 'kcbus:02001', color: '#000000', textColor: '#FFFFFF', shortName: '市バス２０（菱川→淀）' },
  {
    id: 'kcbus:02002',
    color: '#000000',
    textColor: '#FFFFFF',
    shortName: '市バス２０（南横大路→淀）',
  },
  {
    id: 'kcbus:02041',
    color: '#000000',
    textColor: '#FFFFFF',
    shortName: '市バス伏見港２０（南横大路経由）',
  },
  {
    id: 'kcbus:02042',
    color: '#000000',
    textColor: '#FFFFFF',
    shortName: '市バス伏見港２０（菱川経由）',
  },
  { id: 'kcbus:02200', color: '#000000', textColor: '#FFFFFF', shortName: '市バス２２' },
  { id: 'kcbus:0229E', color: '#000000', textColor: '#FFFFFF', shortName: '市バス伏見港２２' },
  { id: 'kcbus:02300', color: '#000000', textColor: '#FFFFFF', shortName: '市バス２３' },
  { id: 'kcbus:02500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス２５' },
  { id: 'kcbus:02600', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス２６' },
  { id: 'kcbus:02700', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス２７' },
  { id: 'kcbus:02703', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス特２７' },
  { id: 'kcbus:02800', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス２８' },
  { id: 'kcbus:02900', color: '#000000', textColor: '#FFFFFF', shortName: '市バス２９' },
  { id: 'kcbus:03100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス３１' },
  { id: 'kcbus:03200', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス３２' },
  { id: 'kcbus:03300', color: '#000000', textColor: '#FFFFFF', shortName: '市バス３３' },
  { id: 'kcbus:03303', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特３３' },
  { id: 'kcbus:03700', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス３７' },
  { id: 'kcbus:03703', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス特３７' },
  { id: 'kcbus:04200', color: '#000000', textColor: '#FFFFFF', shortName: '市バス４２' },
  { id: 'kcbus:04300', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス４３' },
  { id: 'kcbus:04600', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス４６' },
  { id: 'kcbus:04603', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス三条京阪４６' },
  { id: 'kcbus:05000', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス５０' },
  { id: 'kcbus:05100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス５１' },
  { id: 'kcbus:05200', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス５２' },
  { id: 'kcbus:05300', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス５３' },
  { id: 'kcbus:05303', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス白梅町５３' },
  { id: 'kcbus:05500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス５５' },
  { id: 'kcbus:05800', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス５８' },
  { id: 'kcbus:05900', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス５９' },
  { id: 'kcbus:06500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス６５' },
  { id: 'kcbus:06700', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス６７' },
  { id: 'kcbus:06900', color: '#000000', textColor: '#FFFFFF', shortName: '市バス６９' },
  { id: 'kcbus:07000', color: '#000000', textColor: '#FFFFFF', shortName: '市バス７０' },
  { id: 'kcbus:07100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス７１' },
  { id: 'kcbus:07103', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス特７１' },
  { id: 'kcbus:071A0', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス八条口７１' },
  { id: 'kcbus:071A3', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス八条口特７１' },
  { id: 'kcbus:07500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス７５' },
  { id: 'kcbus:07800', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス７８' },
  { id: 'kcbus:08000', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス８０' },
  { id: 'kcbus:08003', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特８０' },
  { id: 'kcbus:08100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス８１' },
  { id: 'kcbus:0819B', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス伏見港８１' },
  { id: 'kcbus:08400', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス８４' },
  { id: 'kcbus:08500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス８５' },
  { id: 'kcbus:08600', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス８６' },
  { id: 'kcbus:08603', color: '#FFC0CB', textColor: '#000000', shortName: 'ぎおん・よるバス' },
  { id: 'kcbus:09100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス９１' },
  { id: 'kcbus:09300', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス９３' },
  { id: 'kcbus:09315', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス快速９３' },
  {
    id: 'kcbus:10000',
    color: '#FC0FC0',
    textColor: '#FFFFFF',
    shortName: '市バス観光特急ＥＸ１００',
  },
  {
    id: 'kcbus:10100',
    color: '#FC0FC0',
    textColor: '#FFFFFF',
    shortName: '市バス観光特急ＥＸ１０１',
  },
  { id: 'kcbus:10200', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１０２' },
  { id: 'kcbus:10500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１０５' },
  { id: 'kcbus:10600', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス１０６' },
  { id: 'kcbus:20100', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス２０１' },
  { id: 'kcbus:20200', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス２０２' },
  { id: 'kcbus:20285', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス快速立命館' },
  { id: 'kcbus:20295', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス快速２０２' },
  { id: 'kcbus:202A2', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス八条口２０２' },
  { id: 'kcbus:20300', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス２０３' },
  { id: 'kcbus:20400', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス２０４' },
  { id: 'kcbus:20500', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス２０５' },
  {
    id: 'kcbus:20584',
    color: '#0000FF',
    textColor: '#FFFFFF',
    shortName: '市バス立命館ダイレクト',
  },
  { id: 'kcbus:20585', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス快速立命館' },
  { id: 'kcbus:20595', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス快速２０５' },
  { id: 'kcbus:20600', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス２０６' },
  { id: 'kcbus:20700', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス２０７' },
  { id: 'kcbus:207A2', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス八条口２０７' },
  { id: 'kcbus:20800', color: '#FF4500', textColor: '#FFFFFF', shortName: '市バス２０８' },
  { id: 'kcbus:AAAAA', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス' },
  { id: 'kcbus:J058A', color: '#0000FF', textColor: '#FFFFFF', shortName: '快速立命館' },
  { id: 'kcbus:J059A', color: '#0000FF', textColor: '#FFFFFF', shortName: '快速２０５' },
  { id: 'kcbus:K0303', color: '#0000FF', textColor: '#FFFFFF', shortName: '北３' },
  { id: 'kcbus:K86BB', color: '#0000FF', textColor: '#FFFFFF', shortName: '８６' },
  { id: 'kcbus:M0100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バスＭ１' },
  { id: 'kcbus:N0100', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス北１' },
  { id: 'kcbus:N0300', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス北３' },
  { id: 'kcbus:N0800', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス北８' },
  { id: 'kcbus:S0100', color: '#000000', textColor: '#FFFFFF', shortName: '市バス南１' },
  { id: 'kcbus:S0103', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特南１' },
  { id: 'kcbus:S0200', color: '#000000', textColor: '#FFFFFF', shortName: '市バス南２' },
  { id: 'kcbus:S0300', color: '#000000', textColor: '#FFFFFF', shortName: '市バス南３' },
  { id: 'kcbus:S038A', color: '#000000', textColor: '#FFFFFF', shortName: '市バス伏見港南３' },
  { id: 'kcbus:S0500', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス南５' },
  { id: 'kcbus:S0600', color: '#0000FF', textColor: '#FFFFFF', shortName: '市バス南６' },
  { id: 'kcbus:S0800', color: '#000000', textColor: '#FFFFFF', shortName: '市バス南８' },
  { id: 'kcbus:S0883', color: '#000000', textColor: '#FFFFFF', shortName: '市バス伏見港南８' },
  { id: 'kcbus:W0100', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西１' },
  { id: 'kcbus:W0200', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西２' },
  { id: 'kcbus:W028D', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西２' },
  { id: 'kcbus:W029D', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西２（→西４）' },
  { id: 'kcbus:W0300', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西３' },
  { id: 'kcbus:W038D', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西３' },
  { id: 'kcbus:W0393', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特西３' },
  { id: 'kcbus:W039D', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西３（→特西４）' },
  { id: 'kcbus:W0403', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特西４' },
  { id: 'kcbus:W048D', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西４' },
  { id: 'kcbus:W048E', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特西４' },
  { id: 'kcbus:W049D', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西４（→西２）' },
  { id: 'kcbus:W049E', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特西４（→西３）' },
  { id: 'kcbus:W0500', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西５' },
  { id: 'kcbus:W0583', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特西５' },
  { id: 'kcbus:W0593', color: '#000000', textColor: '#FFFFFF', shortName: '市バス特西５（→西６）' },
  { id: 'kcbus:W0600', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西６' },
  { id: 'kcbus:W0683', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西６' },
  { id: 'kcbus:W0693', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西６（→特西５）' },
  { id: 'kcbus:W0800', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西８' },
  { id: 'kcbus:W0900', color: '#000000', textColor: '#FFFFFF', shortName: '市バス西９' },
] as const;

/** All Kyoto City Bus routes rendered as a column. */
export const KcRoutes: Story = {
  args: { color: '#0000FF', text: '市バス１', textColor: '#FFFFFF' },
  render: () => (
    <div className="flex flex-col gap-2">
      {KC_ROUTES.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          [<span className="font-mono text-xs">{s.id}</span>
          <span className="font-mono text-xs">{s.color}</span>
          <span className="font-mono text-xs">{s.textColor}</span>
          ]
          <ColorPalette color={s.color} text={s.shortName} textColor={s.textColor} />
        </div>
      ))}
    </div>
  ),
};

/**
 * Every ACTV Navigazione (ベネチア水上バス) route_color /
 * route_text_color pair from the actvnav dataset, sorted by
 * `route_id`. Includes route "1" whose route_color is pure `#FFFFFF`.
 */
const ACTVNAV_ROUTES = [
  { id: 'actvnav:1_UN', color: '#FFFFFF', textColor: '#000000', shortName: '1' },
  { id: 'actvnav:10_UN', color: '#4DC8E9', textColor: '#000000', shortName: '10' },
  { id: 'actvnav:11_UN', color: '#F7ACBC', textColor: '#000000', shortName: '11' },
  { id: 'actvnav:12_UN', color: '#DAD635', textColor: '#000000', shortName: '12' },
  { id: 'actvnav:13_UN', color: '#57419A', textColor: '#FFFFFF', shortName: '13' },
  { id: 'actvnav:14_UN', color: '#F37736', textColor: '#000000', shortName: '14' },
  { id: 'actvnav:15_UN', color: '#DD7127', textColor: '#D9D535', shortName: '15' },
  { id: 'actvnav:17_UN', color: '#82868C', textColor: '#FFFFFF', shortName: '17' },
  { id: 'actvnav:2_UN', color: '#FF0000', textColor: '#FFFFFF', shortName: '2' },
  { id: 'actvnav:2/_UN', color: '#FF0000', textColor: '#FFFFFF', shortName: '2/' },
  { id: 'actvnav:20_UN', color: '#C7AAD1', textColor: '#000000', shortName: '20' },
  { id: 'actvnav:22_UN', color: '#C4C130', textColor: '#00646A', shortName: '22' },
  { id: 'actvnav:3_UN', color: '#F9A262', textColor: '#000000', shortName: '3' },
  { id: 'actvnav:4.1_UN', color: '#B43B96', textColor: '#FFFFFF', shortName: '4.1' },
  { id: 'actvnav:4.2_UN', color: '#B43B96', textColor: '#FFFFFF', shortName: '4.2' },
  { id: 'actvnav:5.1_UN', color: '#8FD2BF', textColor: '#000000', shortName: '5.1' },
  { id: 'actvnav:5.2_UN', color: '#8FD2BF', textColor: '#000000', shortName: '5.2' },
  { id: 'actvnav:6_UN', color: '#006BB7', textColor: '#FFFFFF', shortName: '6' },
  { id: 'actvnav:7_UN', color: '#009366', textColor: '#FFFFFF', shortName: '7' },
  { id: 'actvnav:9_UN', color: '#948F03', textColor: '#FFFFFF', shortName: '9' },
  { id: 'actvnav:N_UN', color: '#25408D', textColor: '#FFFFFF', shortName: 'N' },
  { id: 'actvnav:NLN_UN', color: '#25408D', textColor: '#FFFFFF', shortName: 'NLN' },
  { id: 'actvnav:NMU_UN', color: '#25408D', textColor: '#FFFFFF', shortName: 'NMU' },
] as const;

/** All ACTV Navigazione (ベネチア水上バス) routes rendered as a column. */
export const VeniceRoutes: Story = {
  args: { color: '#FFFFFF', text: '1', textColor: '#000000' },
  render: () => (
    <div className="flex flex-col gap-2">
      {ACTVNAV_ROUTES.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          [<span className="font-mono text-xs">{s.id}</span>
          <span className="font-mono text-xs">{s.color}</span>
          <span className="font-mono text-xs">{s.textColor}</span>
          ]
          <ColorPalette color={s.color} text={s.shortName} textColor={s.textColor} />
        </div>
      ))}
    </div>
  ),
};
