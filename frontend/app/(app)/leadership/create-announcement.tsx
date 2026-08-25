import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { useToast } from '../../../src/store/toast';
import { communityApi, AnnouncementAudience } from '../../../src/api/community';
import { parseApiError } from '../../../src/utils/api-error';

export default function LeadershipCreateAnnouncementScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [selectedAudiences, setSelectedAudiences] = useState<AnnouncementAudience[]>(['RESIDENTS']);
  const [loading, setLoading] = useState(false);

  const toggleAudience = (audience: AnnouncementAudience) => {
    setSelectedAudiences((current) => current.includes(audience)
      ? current.filter((item) => item !== audience)
      : [...current, audience]);
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      showToast({ title: 'Missing Title', message: 'Please enter a title for the announcement.', type: 'error' });
      return;
    }
    if (!content.trim()) {
      showToast({ title: 'Missing Content', message: 'Please provide the announcement message.', type: 'error' });
      return;
    }
    if (selectedAudiences.length === 0) {
      showToast({ title: 'Choose an audience', message: 'Select at least one group for this notice.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await communityApi.postAnnouncementToAudiences({
        title: title.trim(),
        description: content.trim(),
        priority,
        audiences: selectedAudiences,
      });

      showToast({
        title: 'Notice Broadcasted',
        message: `Your notice has been published to ${selectedAudiences.map((audience) => audience === 'OWNERS' ? 'owners' : audience === 'LEADERSHIP' ? 'leadership' : 'residents').join(', ')}.`,
        type: 'success',
      });
      smartBack(router, '/leadership');
    } catch (err) {
      showToast({
        title: 'Broadcast Failed',
        message: parseApiError(err, 'Could not broadcast announcement.'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="subscreen"
        title="Broadcast Notice"
        onBackPress={() => smartBack(router, '/leadership')}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomClearance + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.label}>Announcement Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Annual General Body Meeting Notice"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={theme.colors.textSecondary}
          />

          <Text style={styles.label}>Target Audience</Text>
          <Text style={styles.audienceHint}>Select one or more groups.</Text>
          <View style={styles.audienceRow}>
            {[
              { id: 'RESIDENTS', label: 'Residents' },
              { id: 'OWNERS', label: 'Owners Only' },
              { id: 'LEADERSHIP', label: 'Leadership & Management' },
            ].map((aud) => (
              <TouchableOpacity
                key={aud.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedAudiences.includes(aud.id as AnnouncementAudience) }}
                accessibilityLabel={`Send notice to ${aud.label}`}
                style={[styles.audiencePill, selectedAudiences.includes(aud.id as AnnouncementAudience) && styles.audiencePillActive]}
                onPress={() => toggleAudience(aud.id as AnnouncementAudience)}
              >
                <Feather name={selectedAudiences.includes(aud.id as AnnouncementAudience) ? 'check' : 'plus'} size={14} color={selectedAudiences.includes(aud.id as AnnouncementAudience) ? '#047857' : '#4B5563'} />
                <Text
                  style={[styles.audiencePillText, selectedAudiences.includes(aud.id as AnnouncementAudience) && styles.audiencePillTextActive]}
                >
                  {aud.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Priority Level</Text>
          <View style={styles.priorityRow}>
            {[
              { id: 'NORMAL', label: 'Normal', color: '#10B981' },
              { id: 'IMPORTANT', label: 'Important', color: '#F59E0B' },
              { id: 'URGENT', label: 'Urgent Alert', color: '#EF4444' },
            ].map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.priorityPill,
                  priority === p.id && { backgroundColor: `${p.color}15`, borderColor: p.color },
                ]}
                onPress={() => setPriority(p.id as 'NORMAL' | 'IMPORTANT' | 'URGENT')}
              >
                <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                <Text style={[styles.priorityText, priority === p.id && { color: p.color, fontWeight: '700' }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Announcement Content</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Write the details, instructions, or meeting agenda here..."
            value={content}
            onChangeText={setContent}
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            numberOfLines={6}
          />

          <Button
            label="Publish Notice to Community"
            icon="send"
            onPress={handlePublish}
            loading={loading}
            style={{ marginTop: 24 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  audienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  audiencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  audiencePillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  audienceHint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: -4,
    marginBottom: 8,
  },
  audiencePillText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: '#4B5563',
  },
  audiencePillTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#047857',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  priorityText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: theme.colors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
