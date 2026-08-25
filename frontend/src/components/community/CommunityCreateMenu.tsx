import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { PremiumPressable } from '../ui/PremiumPressable';
import { CommunitySheet } from './CommunitySheet';
import { CreatePollModal } from './CreatePollModal';
import { CreateAnnouncementModal } from './CreateAnnouncementModal';
import { theme } from '../../theme';
import { CreateAnnouncementPayload, CreatePollPayload } from '../../api/community';

type CreateTarget = 'poll' | 'announcement';

interface CommunityCreateMenuProps {
  visible: boolean;
  onClose: () => void;
  onCreatePoll: (payload: CreatePollPayload) => Promise<unknown>;
  onCreateAnnouncement: (payload: CreateAnnouncementPayload) => Promise<unknown>;
  canChoosePollAudience?: boolean;
  canChooseAnnouncementAudience?: boolean;
  householdUnitId?: string;
  canCreateAnnouncement?: boolean;
}

export function CommunityCreateMenu({ visible, onClose, onCreatePoll, onCreateAnnouncement, canChoosePollAudience = false, canChooseAnnouncementAudience = false, householdUnitId, canCreateAnnouncement = true }: CommunityCreateMenuProps) {
  const [active, setActive] = useState<CreateTarget | null>(null);

  const openModal = (target: CreateTarget) => {
    setActive(target);
    onClose();
  };

  const closeActive = () => setActive(null);

  const actions: Array<{
    id: CreateTarget;
    icon: React.ComponentProps<typeof Feather>['name'];
    bg: string;
    color: string;
    title: string;
    description: string;
  }> = [
    { id: 'poll', icon: 'pie-chart', bg: '#E3F2FD', color: '#1976D2', title: 'Create Poll', description: canChoosePollAudience ? 'Ask a selected community group to vote' : 'Ask people in your residence to vote' },
    ...(canCreateAnnouncement ? [{ id: 'announcement' as const, icon: 'bell' as const, bg: '#FFF3E0', color: theme.colors.accent, title: 'Create Announcement', description: 'Publish an important notice' }] : []),
  ];

  return (
    <>
      <CommunitySheet
        visible={visible}
        title="Create"
        subtitle="Start a poll or publish an official community update."
        onClose={onClose}
      >
        <View style={styles.menu}>
          {actions.map((action) => (
            <PremiumPressable
              key={action.id}
              style={styles.menuRow}
              onPress={() => openModal(action.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.menuIcon, { backgroundColor: action.bg }]}>
                <Feather name={action.icon} size={20} color={action.color} />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuTitle}>{action.title}</Text>
                <Text style={styles.menuDesc}>{action.description}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
            </PremiumPressable>
          ))}
        </View>
      </CommunitySheet>

      <CreatePollModal visible={active === 'poll'} onClose={closeActive} onSubmit={onCreatePoll} canChooseAudience={canChoosePollAudience} householdUnitId={householdUnitId} />
      {canCreateAnnouncement ? <CreateAnnouncementModal visible={active === 'announcement'} onClose={closeActive} onSubmit={onCreateAnnouncement} canChooseAudience={canChooseAnnouncementAudience} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    gap: 10,
    paddingBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
    padding: 14,
  },
  menuIcon: {
    width: 46,
    height: 46,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  menuDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});
