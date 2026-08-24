import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../../src/components/ui/Text';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { Button } from '../../../src/components/ui/Button';
import { ScreenEntrance } from '../../../src/components/ui/ScreenEntrance';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { ISSUE_CATEGORIES } from '../../../src/store/issues';
import { ticketsApi } from '../../../src/api/tickets';
import { useToast } from '../../../src/store/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HomeDashboardData, homeDashboardQueryKey } from '../../../src/api/home-dashboard';
import { cardSystem } from '../../../src/components/ui/cardSystem';

export default function RaiseIssueScreen() {
  const router = useRouter();
  const { bottom, bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0].id);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = description.trim().length > 0;

  const createTicketMutation = useMutation({
    mutationFn: ticketsApi.createTicket,
    onSuccess: async (ticket) => {
      queryClient.setQueryData<HomeDashboardData>(homeDashboardQueryKey, (current) =>
        current ? { ...current, tickets: [ticket, ...current.tickets] } : current
      );
      await queryClient.invalidateQueries({ queryKey: homeDashboardQueryKey });
    },
  });

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const cat = ISSUE_CATEGORIES.find((c) => c.id === category)!;

    try {
      await createTicketMutation.mutateAsync({
        category: cat.id,
        title: description.trim().split('\n')[0].slice(0, 50),
        description: description.trim(),
        priority: 'MEDIUM',
      });

      showToast({
        title: 'Ticket raised successfully',
        message: 'Your help desk ticket has been sent to the management team.',
        type: 'success',
      });
      smartBack(router, '/services');
    } catch {
      showToast({
        title: 'Submission Failed',
        message: 'Unable to raise your help desk ticket. Please try again.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Help Desk"
        onBackPress={() => smartBack(router, '/services/maintenance')}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 60 }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance delay={50}>
          <Text style={styles.sectionLabel}>What can we help with?</Text>

          <View style={styles.categoryGrid}>
            {ISSUE_CATEGORIES.map((cat, index) => {
              const selected = category === cat.id;
              return (
                <ScreenEntrance key={cat.id} delay={80 + index * 60} style={styles.categoryTileWrap}>
                  <PremiumPressable
                    style={[styles.categoryTile, selected && { borderColor: cat.color, backgroundColor: cat.bg }]}
                    onPress={() => setCategory(cat.id)}
                    scaleTo={0.97}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: selected ? cat.color : cat.bg }]}>
                      <Feather name={cat.icon} size={20} color={selected ? '#FFFFFF' : cat.color} />
                    </View>
                    <Text style={[styles.categoryLabel, selected && { color: cat.color }]}>
                      {cat.label}
                    </Text>
                    <Text style={styles.categoryHint}>{cat.hint}</Text>
                  </PremiumPressable>
                </ScreenEntrance>
              );
            })}
          </View>
        </ScreenEntrance>

        <ScreenEntrance delay={200}>
          <Text style={styles.sectionLabel}>Tell us more</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Water leaking from under the sink in the master bathroom..."
              placeholderTextColor={theme.colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={300}
            />
            <Text style={styles.charCount}>{description.length}/300</Text>
          </View>
        </ScreenEntrance>
      </ScrollView>

      <View style={[styles.bottomAction, { paddingBottom: Math.max(bottom, 16) }]}>
        <Button label="Raise ticket" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: cardSystem.pagePadding,
    paddingTop: 8,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 14,
    marginLeft: 4,
    marginTop: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  categoryTileWrap: {
    minWidth: 164,
    flexGrow: 1,
    flexBasis: 0,
  },
  categoryTile: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  categoryIcon: {
    width: 46,
    height: 46,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  categoryHint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  inputWrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 16,
    minHeight: 140,
    marginLeft: 4,
    marginRight: 4,
  },
  input: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    minHeight: 90,
    padding: 0,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 6,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
});
