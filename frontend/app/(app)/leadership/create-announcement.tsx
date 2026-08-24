import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { smartBack } from '../../../src/navigation/history';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { AppHeader } from '../../../src/components/ui/AppHeader';
import { useScreenInsets } from '../../../src/hooks/useScreenInsets';
import { theme } from '../../../src/theme';
import { useToast } from '../../../src/store/toast';
import { communityApi, CommunitySpaceItem } from '../../../src/api/community';
import { parseApiError } from '../../../src/utils/api-error';

export default function LeadershipCreateAnnouncementScreen() {
  const router = useRouter();
  const { bottomClearance } = useScreenInsets(false);
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [selectedAudience, setSelectedAudience] = useState<'RESIDENTS' | 'OWNERS' | 'LEADERSHIP'>('RESIDENTS');
  const [spaces, setSpaces] = useState<CommunitySpaceItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    communityApi
      .getSpaces()
      .then((res) => {
        if (res.spaces) {
          setSpaces(res.spaces);
        }
      })
      .catch((err) => console.warn('Could not fetch spaces:', err));
  }, []);

  const handlePublish = async () => {
    if (!title.trim()) {
      showToast({ title: 'Missing Title', message: 'Please enter a title for the announcement.', type: 'error' });
      return;
    }
    if (!content.trim()) {
      showToast({ title: 'Missing Content', message: 'Please provide the announcement message.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const targetType = selectedAudience === 'OWNERS'
        ? 'OWNER_COMMUNITY'
        : selectedAudience === 'LEADERSHIP'
        ? 'LEADERSHIP_OPERATIONS'
        : 'RESIDENT_COMMUNITY';
      const targetSpaceId = spaces.find((space) => space.type === targetType)?.id;

      if (!targetSpaceId) {
        showToast({ title: 'Notice space unavailable', message: 'The selected announcement space is not available for this community.', type: 'error' });
        return;
      }
      await communityApi.postAnnouncementToSpace(targetSpaceId, {
          title: title.trim(),
          content: content.trim(),
          priority,
        });

      showToast({
        title: 'Notice Broadcasted',
        message: `Your notice has been published to ${selectedAudience === 'OWNERS' ? 'owners and eligible owner households' : selectedAudience === 'LEADERSHIP' ? 'leadership and management' : 'residents and tenants'}.`,
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
          <View style={styles.audienceRow}>
            {[
              { id: 'RESIDENTS', label: 'Residents' },
              { id: 'OWNERS', label: 'Owners Only' },
              { id: 'LEADERSHIP', label: 'Leadership & Management' },
            ].map((aud) => (
              <TouchableOpacity
                key={aud.id}
                style={[styles.audiencePill, selectedAudience === aud.id && styles.audiencePillActive]}
                onPress={() => setSelectedAudience(aud.id as any)}
              >
                <Text
                  style={[styles.audiencePillText, selectedAudience === aud.id && styles.audiencePillTextActive]}
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
                onPress={() => setPriority(p.id as any)}
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
