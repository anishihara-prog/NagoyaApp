import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme';
import { DISTRICT_LIST } from '../data/districts';

const TB = ({ label, active, onPress, style }) => (
  <TouchableOpacity onPress={onPress} style={[styles.tb, active && styles.tbOn, style]} activeOpacity={0.7}>
    <Text style={[styles.tbTxt, active && styles.tbTxtOn]}>{label}</Text>
  </TouchableOpacity>
);

const Sec = ({ icon, title, note, children }) => (
  <View style={styles.block}>
    <View style={styles.secHdr}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={styles.secTitle}>{title}</Text>
    </View>
    {note && <Text style={styles.secNote}>{note}</Text>}
    {children}
  </View>
);

export default function ProfileScreen({ navigation }) {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [marital, setMarital] = useState('');
  const [living, setLiving] = useState('');
  const [employment, setEmployment] = useState('');
  const [housing, setHousing] = useState('');
  const [income, setIncome] = useState('');
  const [district, setDistrict] = useState('');

  const [children, setChildren] = useState([]);
  const [childIdx, setChildIdx] = useState(0);

  const [elderlyMembers, setElderlyMembers] = useState([]);
  const [elderlyIdx, setElderlyIdx] = useState(0);

  const [disabledMembers, setDisabledMembers] = useState([]);
  const [concerns, setConcerns] = useState([]);

  const addChild = () => {
    const i = childIdx; setChildIdx(i + 1);
    setChildren([...children, { id: i, age: '', status: '' }]);
  };
  const updateChild = (id, key, val) => setChildren(children.map(c => c.id === id ? { ...c, [key]: val } : c));
  const removeChild = (id) => setChildren(children.filter(c => c.id !== id));

  const addElderly = () => {
    const i = elderlyIdx; setElderlyIdx(i + 1);
    setElderlyMembers([...elderlyMembers, { id: i, age: '', relation: '', careLevel: '', careService: '' }]);
  };
  const updateElderly = (id, key, val) => setElderlyMembers(elderlyMembers.map(e => e.id === id ? { ...e, [key]: val } : e));
  const removeElderly = (id) => setElderlyMembers(elderlyMembers.filter(e => e.id !== id));

  const togDisabled = (v) => setDisabledMembers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const togConcern = (v) => setConcerns(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const doSearch = () => {
    // 子どもの状況から自動的にconcernsを補完
    const autoConcerns = [...concerns];
    children.forEach(c => {
      if (c.status === 'futoko' && !autoConcerns.includes('hikikomori_concern')) autoConcerns.push('hikikomori_concern');
      if (c.status === 'futoko' && !autoConcerns.includes('education')) autoConcerns.push('education');
      if (c.status === 'special' && !autoConcerns.includes('child_disability')) autoConcerns.push('child_disability');
      if (['nursery','elementary','junior','high'].includes(c.status) && !autoConcerns.includes('childcare')) autoConcerns.push('childcare');
    });
    // 高齢者がいる場合
    if (elderlyMembers.length > 0 && !autoConcerns.includes('nursing')) autoConcerns.push('nursing');
    // 就労状況から
    if (employment === 'unemployed' && !autoConcerns.includes('work')) autoConcerns.push('work');
    // 収入から
    if ((income === 'low' || income === 'nontax') && !autoConcerns.includes('money')) autoConcerns.push('money');

    navigation.navigate('Results', {
      profile: {
        age, gender, marital, living, employment, housing, income, district,
        children: children.map(c => ({ age: parseInt(c.age) || 0, status: c.status })),
        elderlyMembers,
        disabledMembers,
        concerns: autoConcerns,
        sit: [
          ...(disabledMembers.includes('disabled') ? ['disabled'] : []),
          ...(disabledMembers.includes('gray') ? ['gray'] : []),
          ...(disabledMembers.includes('hikikomori') ? ['hikikomori'] : []),
          ...(children.some(c => c.status === 'futoko') ? ['hikikomori'] : []),
          ...(autoConcerns.includes('nursing') ? ['nursing'] : []),
          ...(autoConcerns.includes('pregnant') ? ['pregnant'] : []),
          ...(employment === 'unemployed' ? ['unemployed'] : []),
          ...(income === 'low' || income === 'nontax' ? ['lowincome'] : []),
          ...(elderlyMembers.length > 0 ? ['elderly'] : []),
        ],
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.hero}>
          <View style={styles.cityBadge}>
            <Ionicons name="business-outline" size={12} color={colors.primary} />
            <Text style={styles.cityBadgeTxt}>名古屋市 公式サービス検索</Text>
          </View>
          <Text style={styles.heroTitle}>あなたの世帯に合った{'\n'}サービスを探す</Text>
          <Text style={styles.heroSub}>詳しく入力するほど、あなたに合ったサービスが絞り込まれます。</Text>
        </View>

        {/* ── お住まいの区 ── */}
        <Sec icon="location-outline" title="お住まいの区" note="防災情報・区別サービスの表示に使用します">
          <View style={styles.distGrid}>
            {DISTRICT_LIST.map(d => (
              <TB key={d.key} label={d.name} active={district === d.key} onPress={() => setDistrict(district === d.key ? '' : d.key)} style={styles.distBtn} />
            ))}
          </View>
        </Sec>

        <View style={styles.div} />

        {/* ── 本人情報 ── */}
        <Sec icon="person-outline" title="本人の情報">
          <View style={styles.field}>
            <Text style={styles.lbl}>年齢</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="例：35" placeholderTextColor={colors.textTertiary} maxLength={3} />
          </View>
          <View style={styles.field}>
            <Text style={styles.lbl}>性別</Text>
            <View style={styles.trow}>
              {[['男性','male'],['女性','female'],['その他','other'],['未回答','none']].map(([l,v]) => (
                <TB key={v} label={l} active={gender===v} onPress={() => setGender(gender===v?'':v)} style={styles.tFlex} />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.lbl}>婚姻状況</Text>
            <View style={styles.trow}>
              {[['独身','single'],['既婚','married'],['離婚・別居','div'],['死別','widow']].map(([l,v]) => (
                <TB key={v} label={l} active={marital===v} onPress={() => setMarital(marital===v?'':v)} style={styles.tFlex} />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.lbl}>居住形態</Text>
            <View style={styles.trow}>
              {[['一人暮らし','alone'],['家族と同居','family']].map(([l,v]) => (
                <TB key={v} label={l} active={living===v} onPress={() => setLiving(living===v?'':v)} style={styles.tFlex} />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.lbl}>就労状況</Text>
            <View style={styles.trow}>
              {[['正社員・公務員','fulltime'],['パート・アルバイト','parttime'],['自営業・フリー','self'],['育休・産休中','parental'],['求職中・無職','unemployed'],['学生','student'],['障害等で未就労','disabled_work']].map(([l,v]) => (
                <TB key={v} label={l} active={employment===v} onPress={() => setEmployment(employment===v?'':v)} style={styles.tAuto} />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.lbl}>住まいの種類</Text>
            <View style={styles.trow}>
              {[['持ち家（戸建て）','owned_house'],['持ち家（マンション）','owned_apt'],['民間賃貸','rental'],['公営住宅','public'],['社宅・寮','company'],['その他・不安定','other_housing']].map(([l,v]) => (
                <TB key={v} label={l} active={housing===v} onPress={() => setHousing(housing===v?'':v)} style={styles.tAuto} />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.lbl}>世帯収入の目安</Text>
            <View style={styles.trow}>
              {[['住民税非課税','nontax'],['低所得（年収200万以下）','low'],['一般（年収200〜600万）','middle'],['比較的高め（年収600万超）','high'],['わからない','unknown']].map(([l,v]) => (
                <TB key={v} label={l} active={income===v} onPress={() => setIncome(income===v?'':v)} style={styles.tAuto} />
              ))}
            </View>
          </View>
        </Sec>

        <View style={styles.div} />

        {/* ── 子ども ── */}
        <Sec icon="happy-outline" title="お子さまの情報">
          {children.map((c, idx) => (
            <View key={c.id} style={styles.memberCard}>
              <View style={styles.memberCardHdr}>
                <Text style={styles.memberCardTitle}>{idx+1}人目のお子さま</Text>
                <TouchableOpacity onPress={() => removeChild(c.id)}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.ageRow}>
                <Text style={styles.lbl}>年齢</Text>
                <TextInput style={[styles.input, {width:80}]} value={c.age} onChangeText={v => updateChild(c.id,'age',v)} keyboardType="number-pad" placeholder="歳" placeholderTextColor={colors.textTertiary} maxLength={2} />
              </View>
              <View style={styles.field}>
                <Text style={styles.lbl}>状況</Text>
                <View style={styles.trow}>
                  {[['保育所・幼稚園通園中','nursery'],['小学生','elementary'],['中学生','junior'],['高校生','high'],['不登校・登校しぶり','futoko'],['障害・発達支援中','special'],['未就園','none_school']].map(([l,v]) => (
                    <TB key={v} label={l} active={c.status===v} onPress={() => updateChild(c.id,'status',c.status===v?'':v)} style={styles.tAuto} />
                  ))}
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={addChild} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.addBtnTxt}>子どもを追加</Text>
          </TouchableOpacity>
        </Sec>

        <View style={styles.div} />

        {/* ── 高齢者 ── */}
        <Sec icon="people-outline" title="同居する高齢者の情報" note="ご自身が高齢の場合もここに入力してください">
          {elderlyMembers.map((e, idx) => (
            <View key={e.id} style={styles.memberCard}>
              <View style={styles.memberCardHdr}>
                <Text style={styles.memberCardTitle}>高齢者{idx+1}人目</Text>
                <TouchableOpacity onPress={() => removeElderly(e.id)}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <View style={styles.ageRow}>
                <Text style={styles.lbl}>年齢</Text>
                <TextInput style={[styles.input, {width:80}]} value={e.age} onChangeText={v => updateElderly(e.id,'age',v)} keyboardType="number-pad" placeholder="歳" placeholderTextColor={colors.textTertiary} maxLength={3} />
              </View>
              <View style={styles.field}>
                <Text style={styles.lbl}>続柄</Text>
                <View style={styles.trow}>
                  {[['本人','self'],['親','parent'],['祖父母','grand'],['配偶者','spouse'],['その他','other']].map(([l,v]) => (
                    <TB key={v} label={l} active={e.relation===v} onPress={() => updateElderly(e.id,'relation',v)} style={styles.tAuto} />
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.lbl}>要介護度</Text>
                <View style={styles.trow}>
                  {[['不明','unknown'],['自立','none'],['要支援1','s1'],['要支援2','s2'],['要介護1','c1'],['要介護2','c2'],['要介護3','c3'],['要介護4','c4'],['要介護5','c5']].map(([l,v]) => (
                    <TB key={v} label={l} active={e.careLevel===v} onPress={() => updateElderly(e.id,'careLevel',v)} style={styles.tAuto} />
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.lbl}>介護保険サービスの利用状況</Text>
                <View style={styles.trow}>
                  {[['未申請','not_applied'],['申請中','applying'],['利用中','using'],['利用していない','not_using']].map(([l,v]) => (
                    <TB key={v} label={l} active={e.careService===v} onPress={() => updateElderly(e.id,'careService',v)} style={styles.tAuto} />
                  ))}
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={addElderly} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.addBtnTxt}>高齢者を追加</Text>
          </TouchableOpacity>
        </Sec>

        <View style={styles.div} />

        {/* ── 障害・困難 ── */}
        <Sec icon="accessibility-outline" title="障害・困難がある方" note="ご本人または同居の方にあてはまるものをすべて選択">
          <View style={styles.trow}>
            {[['身体障害（手帳あり）','disabled'],['知的障害（療育手帳）','intellectual'],['精神障害（手帳あり）','mental'],['発達障害の疑い\n（診断なし）','gray'],['ひきこもり・\n不登校','hikikomori']].map(([l,v]) => (
              <TB key={v} label={l} active={disabledMembers.includes(v)} onPress={() => togDisabled(v)} style={styles.tAuto} />
            ))}
          </View>
        </Sec>

        <View style={styles.div} />

        {/* ── 困っていること ── */}
        <Sec icon="help-circle-outline" title="困っていること・相談したいこと" note="あてはまるものをすべて選択。これで検索結果が絞り込まれます。">
          <View style={styles.trow}>
            {[
              ['妊娠・出産のこと','pregnant'],
              ['子育て・保育のこと','childcare'],
              ['子どもの教育・学校のこと','education'],
              ['子どもの障害・発達のこと','child_disability'],
              ['介護・高齢者のこと','nursing'],
              ['仕事・就労のこと','work'],
              ['お金・生活費のこと','money'],
              ['住まいのこと','housing_concern'],
              ['健康・医療のこと','health'],
              ['心の健康・メンタルのこと','mental_health'],
              ['障害福祉サービスのこと','disability_service'],
              ['ひきこもり・不登校のこと','hikikomori_concern'],
              ['DV・虐待・ハラスメント','dv'],
              ['防災・災害への備え','disaster'],
              ['外国人・多文化共生','foreign'],
              ['消費生活・詐欺被害','consumer'],
              ['不妊・不育症のこと','infertility'],
              ['認知症のこと','dementia'],
              ['感染症・予防接種のこと','vaccination'],
              ['行政手続き・証明のこと','admin'],
              ['税・国民年金のこと','tax'],
              ['ごみ・リサイクルのこと','waste'],
              ['交通・移動のこと','transport'],
              ['ペット・動物のこと','pet'],
            ].map(([l,v]) => (
              <TB key={v} label={l} active={concerns.includes(v)} onPress={() => togConcern(v)} style={styles.tAuto} />
            ))}
          </View>
        </Sec>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity style={styles.cta} onPress={doSearch} activeOpacity={0.85}>
            <Ionicons name="search-outline" size={18} color={colors.primary} />
            <Text style={styles.ctaTxt}>サービスを検索する</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  hero: { padding: spacing.lg, paddingBottom: spacing.md },
  cityBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.primaryBg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  cityBadgeTxt: { fontSize: 11, fontWeight: font.medium, color: colors.primary },
  heroTitle: { fontSize: 20, fontWeight: font.semibold, color: colors.textPrimary, lineHeight: 28, marginBottom: 6 },
  heroSub: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  block: { padding: spacing.lg, paddingBottom: spacing.md },
  secHdr: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  secTitle: { fontSize: 14, fontWeight: font.semibold, color: colors.textPrimary },
  secNote: { fontSize: 12, color: colors.textTertiary, marginBottom: 10 },
  div: { height: 8, backgroundColor: colors.bgSecondary },
  field: { marginBottom: 12 },
  lbl: { fontSize: 12, color: colors.textSecondary, marginBottom: 5 },
  input: { borderWidth: 0.5, borderColor: colors.borderMed, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.bgPrimary },
  trow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tFlex: { flex: 1, minWidth: 72 },
  tAuto: { flex: 0, minWidth: 0, paddingHorizontal: 11, paddingVertical: 7 },
  tb: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.borderMed, backgroundColor: colors.bgPrimary, alignItems: 'center' },
  tbOn: { borderColor: colors.accent, backgroundColor: colors.primaryBg },
  tbTxt: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  tbTxtOn: { color: colors.primary, fontWeight: font.medium },
  distGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  distBtn: { flex: 0, minWidth: 0, paddingHorizontal: 12, paddingVertical: 8 },
  memberCard: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 12, marginBottom: 10 },
  memberCardHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  memberCardTitle: { fontSize: 13, fontWeight: font.semibold, color: colors.textPrimary },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 0.5, borderStyle: 'dashed', borderColor: colors.borderMed, borderRadius: radius.md, paddingVertical: 10 },
  addBtnTxt: { fontSize: 13, color: colors.textSecondary },
  ctaWrap: { padding: spacing.lg, paddingTop: spacing.md },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryBg, borderRadius: radius.lg, paddingVertical: 15, borderWidth: 0.5, borderColor: colors.primaryLight },
  ctaTxt: { fontSize: 15, fontWeight: font.semibold, color: colors.primary },
});
