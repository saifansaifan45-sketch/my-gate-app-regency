import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { AnimatedEntrance } from '../../../src/components/ui/AnimatedEntrance';
import { PremiumPressable } from '../../../src/components/ui/PremiumPressable';
import { theme } from '../../../src/theme';
import { useSession } from '../../../src/store/auth';
import { useToast } from '../../../src/store/toast';
import { EmployeeRole } from '../../../src/api/auth';

import { formatErrorMessage } from '../../../src/utils/errors';

type ConnectionType = 'OWNER' | 'RESIDENT' | 'EMPLOYEE' | null;

const POPULAR_UNITS = [
  'GA',
  'GB',
  ...Array.from({ length: 9 }, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat(),
];

const EMPLOYEE_ROLES: { id: EmployeeRole; label: string; reviewNote: string }[] = [
  { id: 'MANAGER', label: 'Community Manager', reviewNote: 'Your application will be reviewed by Regency Salma leadership.' },
  { id: 'SECURITY', label: 'Security', reviewNote: 'Your application will be reviewed by the community manager.' },
  { id: 'MAINTENANCE', label: 'Maintenance', reviewNote: 'Your application will be reviewed by the community manager.' },
  { id: 'HOUSEKEEPING', label: 'Housekeeping', reviewNote: 'Your application will be reviewed by the community manager.' },
  { id: 'OTHER', label: 'Other', reviewNote: 'Your application will be reviewed by the community manager.' },
];

export default function RelationshipOnboardingScreen() {
  const router = useRouter();
  const { user, onboardOwner, onboardResident, onboardEmployee, logout, refreshProfile } = useSession();
  const { showToast } = useToast();

  const [selectedType, setSelectedType] = useState<ConnectionType>(null);

  // Owner Form State
  const [ownerFlat, setOwnerFlat] = useState('9A');
  const [livesHere, setLivesHere] = useState(true);

  // Resident Form State
  const [residentFlat, setResidentFlat] = useState('9B');
  const [relationshipType, setRelationshipType] = useState<'TENANT' | 'FAMILY_MEMBER'>('TENANT');

  // Employee Form State
  const [employeeRole, setEmployeeRole] = useState<EmployeeRole>('MANAGER');
  const [department, setDepartment] = useState('Township Operations');
  const [experience, setExperience] = useState('');

  // Pending approval screen state
  const [isPendingApproval, setIsPendingApproval] = useState(Boolean(user?.isPendingApproval));
  const [isWorkforceApproved, setIsWorkforceApproved] = useState(
    Boolean(user?.memberships?.some((m) => m.role === 'WORKFORCE' && m.status === 'APPROVED'))
  );
  const isExistingEmployee = Boolean(user?.memberships?.some((m) => (m.role === 'MANAGER' || m.role === 'WORKFORCE' || m.role === 'LEADERSHIP')));
  const [isAvailable, setIsAvailable] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  // 1. Submit Owner Flow
  const handleOwnerSubmit = async () => {
    if (!ownerFlat.trim()) {
      showToast({ title: 'Flat Required', message: 'Please specify your unit number.', type: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await onboardOwner({
        flatNumber: ownerFlat.trim().toUpperCase(),
        livesHere,
      });
      showToast({
        title: livesHere ? 'Setup Complete' : 'Ownership Registered',
        message: `Welcome to Regency Salma Unit ${ownerFlat.toUpperCase()}.`,
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Setup Failed',
        message: formatErrorMessage(err, 'Could not complete owner onboarding.'),
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Submit Resident Flow
  const handleResidentSubmit = async () => {
    if (!residentFlat.trim()) {
      showToast({ title: 'Flat Required', message: 'Please specify your unit number.', type: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await onboardResident({
        flatNumber: residentFlat.trim().toUpperCase(),
        relationshipType,
      });
      showToast({
        title: 'Request Submitted',
        message: `Verification request sent to Unit ${residentFlat.toUpperCase()} property owner.`,
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Submission Failed',
        message: formatErrorMessage(err, 'Could not submit residency request.'),
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Submit Employee Flow
  const handleEmployeeSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await onboardEmployee({
        role: employeeRole,
        department: department.trim() || undefined,
        experience: experience.trim() || undefined,
      });

      if (res.status === 'PENDING_APPROVAL') {
        setIsPendingApproval(true);
        showToast({
          title: 'Application Submitted',
          message: employeeRole === 'MANAGER'
            ? 'Your application will be reviewed by Regency Salma leadership.'
            : 'Your application will be reviewed by the community manager.',
          type: 'success',
        });
      }
    } catch (err: any) {
      showToast({
        title: 'Submission Failed',
        message: formatErrorMessage(err, 'Could not submit staff application.'),
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      await refreshProfile();
      const isMgr = user?.memberships?.some((m) => (m.role === 'MANAGER' || m.role === 'LEADERSHIP') && m.status === 'APPROVED');
      const isWf = user?.memberships?.some((m) => m.role === 'WORKFORCE' && m.status === 'APPROVED');

      if (isMgr) {
        setIsPendingApproval(false);
        showToast({ title: 'Application Approved!', message: 'Welcome to Regency Salma Operations Manager workspace.', type: 'success' });
        router.replace('/(app)/manager');
      } else if (isWf) {
        setIsPendingApproval(false);
        setIsWorkforceApproved(true);
        showToast({ title: 'Application Approved!', message: 'Welcome to Regency Salma Staff Workspace.', type: 'success' });
      } else {
        showToast({ title: 'Pending Review', message: 'Your request is currently waiting for approval.', type: 'info' });
      }
    } catch {
      showToast({ title: 'Status Check', message: 'Could not refresh status. Please try again.', type: 'error' });
    }
  };

  // ----------------------------------------------------
  // Render: Approved Employee Work Dashboard
  // ----------------------------------------------------
  if (isWorkforceApproved) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.dashboardContent}>
          {/* Header */}
          <View style={styles.workHeader}>
            <View>
              <Text style={styles.workGreeting}>Regency Salma · Operations Staff</Text>
              <Text style={styles.workName}>
                {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Workforce Staff'}
              </Text>
            </View>
            <TouchableOpacity style={styles.logoutIconBtn} onPress={() => logout()}>
              <Feather name="log-out" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Duty Status Card */}
          <View style={styles.dutyCard}>
            <View style={styles.dutyInfo}>
              <Text style={styles.dutyTitle}>Availability Status</Text>
              <Text style={styles.dutySub}>
                {isAvailable ? 'On Duty · Ready for tasks' : 'Off Duty · Not accepting tasks'}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
              thumbColor={isAvailable ? '#10B981' : '#9CA3AF'}
            />
          </View>

          {/* Assigned Tasks */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Tasks (0)</Text>
          </View>
          <View style={styles.workEmptyCard}>
            <Feather name="check-circle" size={32} color="#10B981" style={{ marginBottom: 8 }} />
            <Text style={styles.workEmptyTitle}>All Caught Up!</Text>
            <Text style={styles.workEmptyDesc}>No maintenance or operations tasks currently assigned.</Text>
          </View>

          {/* Announcements */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Staff Announcements</Text>
          </View>
          <View style={styles.announcementCard}>
            <View style={styles.announcementIcon}>
              <Feather name="bell" size={18} color="#2E7D32" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.announcementTitle}>Operations Briefing</Text>
              <Text style={styles.announcementTime}>Regency Salma Operations · Active</Text>
              <Text style={styles.announcementBody}>
                Please ensure all equipment checks are completed and logged during your shift.
              </Text>
            </View>
          </View>

          <Button
            label="Sign Out"
            variant="secondary"
            icon="log-out"
            onPress={() => logout()}
            style={{ marginTop: 24 }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------
  // Render: Pending Approval View for Employee
  // ----------------------------------------------------
  if (isPendingApproval) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.pendingContainer}>
          <View style={styles.pendingCard}>
            <View style={styles.pendingIconBox}>
              <Feather name="clock" size={32} color="#D97706" />
            </View>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>PENDING APPROVAL</Text>
            </View>

            <Text style={styles.pendingTitle}>Application Submitted</Text>
            <Text style={styles.pendingDesc}>
              Your request is waiting for approval.{'\n\n'}You will receive access once your application is approved.
            </Text>

            <View style={styles.divider} />

            <View style={styles.applicantInfoRow}>
              <Text style={styles.infoLabel}>Applicant:</Text>
              <Text style={styles.infoValue}>
                {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Community Applicant'}
              </Text>
            </View>
            <View style={styles.applicantInfoRow}>
              <Text style={styles.infoLabel}>Role Requested:</Text>
              <Text style={styles.infoValue}>{employeeRole}</Text>
            </View>
            <View style={styles.applicantInfoRow}>
              <Text style={styles.infoLabel}>Reviewing Authority:</Text>
              <Text style={styles.infoValue}>
                {employeeRole === 'MANAGER' ? 'Leadership' : 'Community Manager'}
              </Text>
            </View>

            <Button
              label="Check Approval Status"
              icon="refresh-cw"
              onPress={handleCheckStatus}
              style={{ marginTop: 24, width: '100%' }}
            />
            <Button
              label="Sign Out"
              variant="secondary"
              icon="log-out"
              onPress={() => logout()}
              style={{ marginTop: 10, width: '100%' }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------
  // Render: Step 2 Relationship Choice Screen
  // ----------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, !selectedType && styles.scrollCentered]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <AnimatedEntrance delay={30} distance={12}>
            <View style={styles.header}>
              {selectedType ? (
                <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedType(null)}>
                  <Feather name="arrow-left" size={20} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              ) : null}
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 2 OF 2 · RELATIONSHIP</Text>
              </View>
              <Text style={styles.mainTitle}>
                {selectedType === 'EMPLOYEE' ? 'Join Regency Salma' : 'What brings you to Regency Salma?'}
              </Text>
              <Text style={styles.mainSub}>
                {selectedType === 'OWNER'
                  ? 'Configure your property ownership details'
                  : selectedType === 'RESIDENT'
                  ? 'Specify your residential living flat'
                  : selectedType === 'EMPLOYEE'
                  ? 'Apply for a community role'
                  : 'Select your primary connection to configure your workspace.'}
              </Text>
            </View>
          </AnimatedEntrance>

          {/* Option Selector (If none selected yet) */}
          {!selectedType ? (
            <AnimatedEntrance delay={80} distance={16}>
              <View style={styles.optionsList}>
                {/* Option 1: I own a property */}
                <PremiumPressable
                  style={styles.optionCard}
                  onPress={() => setSelectedType('OWNER')}
                  scaleTo={0.98}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Feather name="home" size={24} color="#059669" />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>I own a property</Text>
                    <Text style={styles.optionSub}>I own one or more homes in Regency Salma</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </PremiumPressable>

                {/* Option 2: I live in a property */}
                <PremiumPressable
                  style={styles.optionCard}
                  onPress={() => setSelectedType('RESIDENT')}
                  scaleTo={0.98}
                >
                  <View style={[styles.optionIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Feather name="users" size={24} color="#2563EB" />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>I live in a property</Text>
                    <Text style={styles.optionSub}>I am a resident, tenant, or family member</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </PremiumPressable>

                {/* Option 3: I work with the community */}
                {!isExistingEmployee ? (
                  <PremiumPressable
                    style={styles.optionCard}
                    onPress={() => setSelectedType('EMPLOYEE')}
                    scaleTo={0.98}
                  >
                    <View style={[styles.optionIconBox, { backgroundColor: '#FEF3C7' }]}>
                      <Feather name="shield" size={24} color="#D97706" />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>I work with the community</Text>
                      <Text style={styles.optionSub}>Management, security, housekeeping, maintenance staff</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#9CA3AF" />
                  </PremiumPressable>
                ) : null}
              </View>
            </AnimatedEntrance>
          ) : null}

          {/* Option 1 Subflow: Owner */}
          {selectedType === 'OWNER' ? (
            <AnimatedEntrance delay={60} distance={14}>
              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Flat / Unit Number</Text>
                <View style={styles.unitPillGrid}>
                  {POPULAR_UNITS.map((u) => {
                    const isSelected = ownerFlat === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitPill, isSelected && styles.unitPillActive]}
                        onPress={() => setOwnerFlat(u)}
                      >
                        <Text style={[styles.unitPillText, isSelected && styles.unitPillTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Or enter flat number (e.g. 9A, 10B)"
                  value={ownerFlat}
                  onChangeText={(t) => setOwnerFlat(t.toUpperCase())}
                  autoCapitalize="characters"
                  placeholderTextColor={theme.colors.textSecondary}
                />

                {/* Live Here Toggle */}
                <View style={styles.toggleRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleRowTitle}>Do you currently live in this property?</Text>
                    <Text style={styles.toggleRowSub}>
                      {livesHere
                        ? 'Configures account as Owner + Active Resident'
                        : 'Configures account as Property Owner / Landlord'}
                    </Text>
                  </View>
                  <Switch
                    value={livesHere}
                    onValueChange={setLivesHere}
                    trackColor={{ false: '#E5E7EB', true: theme.colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <Button
                  label="Confirm Property Connection"
                  icon="check"
                  onPress={handleOwnerSubmit}
                  loading={submitting}
                  disabled={!ownerFlat.trim() || submitting}
                  style={{ marginTop: 8 }}
                />
              </View>
            </AnimatedEntrance>
          ) : null}

          {/* Option 2 Subflow: Resident */}
          {selectedType === 'RESIDENT' ? (
            <AnimatedEntrance delay={60} distance={14}>
              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Select Your Flat / Unit</Text>
                <View style={styles.unitPillGrid}>
                  {POPULAR_UNITS.map((u) => {
                    const isSelected = residentFlat === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitPill, isSelected && styles.unitPillActive]}
                        onPress={() => setResidentFlat(u)}
                      >
                        <Text style={[styles.unitPillText, isSelected && styles.unitPillTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Or enter flat number (e.g. 9A, 10B)"
                  value={residentFlat}
                  onChangeText={(t) => setResidentFlat(t.toUpperCase())}
                  autoCapitalize="characters"
                  placeholderTextColor={theme.colors.textSecondary}
                />

                <Text style={styles.fieldLabel}>Residency Relationship</Text>
                <View style={styles.roleChoiceRow}>
                  <TouchableOpacity
                    style={[styles.roleChoiceBtn, relationshipType === 'TENANT' && styles.roleChoiceBtnActive]}
                    onPress={() => setRelationshipType('TENANT')}
                  >
                    <Text style={[styles.roleChoiceText, relationshipType === 'TENANT' && styles.roleChoiceTextActive]}>
                      Tenant
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleChoiceBtn, relationshipType === 'FAMILY_MEMBER' && styles.roleChoiceBtnActive]}
                    onPress={() => setRelationshipType('FAMILY_MEMBER')}
                  >
                    <Text style={[styles.roleChoiceText, relationshipType === 'FAMILY_MEMBER' && styles.roleChoiceTextActive]}>
                      Family Member
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoBanner}>
                  <Feather name="info" size={16} color={theme.colors.primary} />
                  <Text style={styles.infoBannerText}>
                    A verification request will be sent to the unit owner for digital approval.
                  </Text>
                </View>

                <Button
                  label="Submit Residency Request"
                  icon="arrow-right"
                  onPress={handleResidentSubmit}
                  loading={submitting}
                  disabled={!residentFlat.trim() || submitting}
                  style={{ marginTop: 8 }}
                />
              </View>
            </AnimatedEntrance>
          ) : null}

          {/* Option 3 Subflow: Employee */}
          {selectedType === 'EMPLOYEE' ? (
            <AnimatedEntrance delay={60} distance={14}>
              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Choose your role</Text>
                <View style={styles.employeeRolesGrid}>
                  {EMPLOYEE_ROLES.map((r) => {
                    const isSelected = employeeRole === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.employeeRoleCard, isSelected && styles.employeeRoleCardActive]}
                        onPress={() => setEmployeeRole(r.id)}
                      >
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected ? <View style={styles.radioDot} /> : null}
                        </View>
                        <Text style={[styles.employeeRoleText, isSelected && styles.employeeRoleTextActive]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Dynamic Review Chain Notice */}
                <View style={styles.reviewNoticeBanner}>
                  <Feather name="shield" size={16} color={employeeRole === 'MANAGER' ? '#B45309' : '#047857'} />
                  <Text style={[styles.reviewNoticeText, employeeRole === 'MANAGER' ? { color: '#92400E' } : { color: '#065F46' }]}>
                    {employeeRole === 'MANAGER'
                      ? 'Your application will be reviewed by Regency Salma leadership.'
                      : 'Your application will be reviewed by the community manager.'}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Department / Trade</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Operations, Security, Facilities"
                  value={department}
                  onChangeText={setDepartment}
                  placeholderTextColor={theme.colors.textSecondary}
                />

                <Text style={styles.fieldLabel}>Relevant Experience (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 4 years residential facility experience"
                  value={experience}
                  onChangeText={setExperience}
                  placeholderTextColor={theme.colors.textSecondary}
                />

                <Button
                  label="Submit Application"
                  icon="check"
                  onPress={handleEmployeeSubmit}
                  loading={submitting}
                  disabled={submitting}
                  style={{ marginTop: 8 }}
                />
              </View>
            </AnimatedEntrance>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 40,
  },
  scrollCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
    marginBottom: 10,
  },
  stepBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    letterSpacing: 1,
    color: theme.colors.primary,
  },
  mainTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
    color: theme.colors.textPrimary,
    marginBottom: 6,
    lineHeight: 30,
  },
  mainSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  optionsList: {
    gap: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 27,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  optionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  optionSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  unitPillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  unitPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unitPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  unitPillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  unitPillTextActive: {
    color: '#FFFFFF',
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  toggleRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F8F5',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,61,42,0.08)',
    marginBottom: 16,
    gap: 12,
  },
  toggleRowTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13.5,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  toggleRowSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  roleChoiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  roleChoiceBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  roleChoiceBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#ECFDF5',
  },
  roleChoiceText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  roleChoiceTextActive: {
    color: theme.colors.primary,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  infoBannerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 16,
  },
  employeeRolesGrid: {
    gap: 8,
    marginBottom: 16,
  },
  employeeRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  employeeRoleCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: theme.colors.primary,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleActive: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  employeeRoleText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  employeeRoleTextActive: {
    color: theme.colors.primary,
  },
  reviewNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reviewNoticeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  // Pending Approval Styles
  pendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pendingCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(20, 61, 42, 0.08)',
    shadowColor: '#143D2A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  pendingIconBox: {
    width: 64,
    height: 64,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingBadge: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 98,
    marginBottom: 12,
  },
  pendingBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#B45309',
  },
  pendingTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: theme.colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  pendingDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  applicantInfoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  // Work Dashboard Styles
  dashboardContent: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 22,
    paddingBottom: 40,
  },
  workHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  workGreeting: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  workName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: theme.colors.textPrimary,
    letterSpacing: -0.4,
  },
  logoutIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 20,
  },
  dutyInfo: { flex: 1 },
  dutyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  dutySub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  sectionHeader: {
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  workEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  workEmptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  workEmptyDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    color: theme.colors.textSecondary,
  },
  announcementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  announcementIcon: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  announcementTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14.5,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  announcementTime: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  announcementBody: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
});
