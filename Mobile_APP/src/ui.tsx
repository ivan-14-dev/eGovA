import React, { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import type { Summaries } from './types'

export const colors = { ink: '#15294b', muted: '#526580', blue: '#214987', background: '#f2f5fb', line: '#d9e2ef' }
export const styles = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.line, gap: 12, marginBottom: 14 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  heading: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  text: { color: colors.ink, lineHeight: 22, fontSize: 14 },
  muted: { color: colors.muted, lineHeight: 21, fontSize: 13 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, backgroundColor: '#fafcff', color: colors.ink, fontSize: 16 },
  button: { minHeight: 46, backgroundColor: colors.blue, borderRadius: 11, padding: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 14, textAlign: 'center' },
  secondary: { backgroundColor: '#e9f0fc' }, secondaryText: { color: colors.blue },
  warning: { backgroundColor: '#fff4dd', padding: 14, borderRadius: 12, marginBottom: 12 },
  warningText: { color: '#73521a', lineHeight: 21, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
})
export function Title({ children }: React.PropsWithChildren) { return <Text accessibilityRole="header" style={styles.title}>{children}</Text> }
export function Body({ children }: React.PropsWithChildren) { return <Text style={styles.text}>{children}</Text> }
export function Card({ title, children }: React.PropsWithChildren<{ title?: string }>) {
  return <View style={styles.card}>{!!title && <Text accessibilityRole="header" style={styles.heading}>{title}</Text>}{children}</View>
}
export function Button({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>
}
export function Field({ label, value, onChange, secret, multiline, numeric }: { label: string; value: string; onChange: (v: string) => void; secret?: boolean; multiline?: boolean; numeric?: boolean }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
    secureTextEntry={secret} multiline={multiline} autoCapitalize="none" autoCorrect={false} keyboardType={numeric ? 'decimal-pad' : 'default'}
    style={[styles.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]} /></View>
}
export function Choice({ label, value, items, onChange }: { label: string; value: string; items: Record<string, string>; onChange: (v: string) => void }) {
  return <View><Text style={styles.label}>{label}</Text><View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10 }}>
    <Picker accessibilityLabel={label} selectedValue={value} onValueChange={(v) => onChange(String(v))}>
      {Object.entries(items).sort(([a], [b]) => a === '' ? -1 : b === '' ? 1 : 0).map(([key, name]) => <Picker.Item key={key} label={name} value={key} />)}
    </Picker></View></View>
}
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <View style={[styles.row, { flexWrap: 'nowrap' }]}><Switch accessibilityLabel={label} value={value} onValueChange={onChange} /><Text style={[styles.text, { flex: 1 }]}>{label}</Text></View>
}
export function Warning({ children }: React.PropsWithChildren) { return <View style={styles.warning}><Text style={styles.warningText}>{children}</Text></View> }
export function Expand({ title, children }: React.PropsWithChildren<{ title: string }>) {
  const [open, setOpen] = useState(false)
  return <Card><Button secondary title={`${open ? '−' : '+'} ${title}`} onPress={() => setOpen(!open)} />{open && children}</Card>
}
export function Scores({ summaries }: { summaries: Summaries }) {
  return <>{Object.entries(summaries).map(([key, s]) => <Card key={key} title={key === 'reglementaire' ? 'Conformité réglementaire' : 'Préparation des marchés'}>
    <Text style={styles.heading}>{s.score === null ? 'Non évalué' : `${s.score} % démontré`}</Text>
    <Body>Couverture : {s.coverage ?? '—'} % · {s.blocking} point(s) critique(s) non démontré(s).</Body>
  </Card>)}<Warning>Auto-évaluation déclarative, pas une certification ni une garantie d’éligibilité.</Warning></>
}
export const Spinner = () => <ActivityIndicator accessibilityLabel="Chargement" size="large" color={colors.blue} />
