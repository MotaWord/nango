import { useState } from 'react';
import { toast } from 'react-toastify';
import { useModal } from '@geist-ui/core';
import ActionModal from '../../../components/ui/ActionModal';
import ToggleButton from '../../../components/ui/button/ToggleButton';
import Spinner from '../../../components/ui/Spinner';
import type { PreBuiltFlow, Flow, Connection, Sync } from '../../../types';
import type { EndpointResponse } from '../Show';
import { useCreateFlow } from '../../../utils/api';
import { useStore } from '../../../store';

export interface FlowProps {
    flow: Flow;
    provider: string;
    providerConfigKey: string;
    reload: () => void;
    rawName?: string;
    connections: Connection[];
    endpoints?: EndpointResponse;
    setIsEnabling?: (isEnabling: boolean) => void;
    showSpinner?: boolean;
}

interface ExtendedPreBuiltFlow extends PreBuiltFlow {
    id?: number;
    provider: string;
    providerConfigKey: string;
    public_route: string;
    model_schema: string;
}

type ExtendedFlow = ExtendedPreBuiltFlow &
    Pick<Flow, 'sync_type' | 'track_deletes' | 'scopes' | 'input' | 'returns' | 'endpoints' | 'is_public' | 'output' | 'pre_built'> &
    Pick<Sync, 'metadata'>;

export default function EnableDisableSync({
    flow,
    endpoints,
    provider,
    providerConfigKey,
    reload,
    rawName,
    connections,
    setIsEnabling,
    showSpinner
}: FlowProps) {
    const env = useStore((state) => state.env);
    const createFlow = useCreateFlow(env);
    const syncs = endpoints?.allFlows?.syncs;
    const actions = endpoints?.allFlows?.actions;
    const currentFlow = flow.type === 'sync' ? syncs?.find((sync) => sync.name === flow.name) : actions?.find((action) => action.name === flow.name);
    const { setVisible, bindings } = useModal();
    const connectionIds = connections.map((connection) => connection.connection_id);

    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState('');
    const [modalOkButtonTitle, setModalOkButtonTitle] = useState('Confirm');
    const [modalCancelButtonTitle, setModalCancelButtonTitle] = useState('Cancel');
    const [modalOkButtonLink, setModalOkButtonLink] = useState<string | null>(null);
    const [modalCancelButtonLink, setModalCancelButtonLink] = useState<string | null>(null);
    const [modalAction, setModalAction] = useState<(() => void) | null>(null);
    const [modalShowSpinner, setModalShowSpinner] = useState(false);
    const [modalTitleColor, setModalTitleColor] = useState('text-white');
    const [enabled, setEnabled] = useState(currentFlow ? currentFlow.enabled : flow?.enabled);

    const resetModal = () => {
        setModalTitle('');
        setModalContent('');
        setModalOkButtonTitle('Confirm');
        setModalCancelButtonTitle('Cancel');
        setModalOkButtonLink(null);
        setModalCancelButtonLink(null);
        setModalAction(null);
        setModalShowSpinner(false);
        setModalTitleColor('text-white');
    };

    const enableSync = (flow: Flow) => {
        resetModal();
        setModalTitle(`Enable ${flow.type}?`);
        setModalTitleColor('text-white');
        const content =
            flow?.type === 'sync'
                ? 'Records will start syncing potentially for multiple connections. This will impact your billing.'
                : 'This will make the action available for immediate use.';
        setModalContent(content);
        setModalAction(() => () => onEnableSync(flow));
        setVisible(true);
    };

    const createNewFlow = async (flow: ExtendedFlow) => {
        setModalShowSpinner(true);
        if (setIsEnabling) {
            setIsEnabling(true);
        }
        const res = await createFlow([flow]);

        await finalizeEnableSync(res, flow.model_schema);
    };

    const reEnableFlow = async (flow: ExtendedFlow) => {
        setModalShowSpinner(true);
        if (setIsEnabling) {
            setIsEnabling(true);
        }

        const res = await fetch(`/api/v1/flow/${flow?.id}/enable?env=${env}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(flow)
        });

        await finalizeEnableSync(res, flow.model_schema);
    };

    const finalizeEnableSync = async (res: Response | undefined, _model_schema: string) => {
        if (!res) {
            setModalShowSpinner(false);
            if (setIsEnabling) {
                setIsEnabling(false);
            }
            setVisible(false);
            toast.error('Something went wrong. Please try again.', {
                position: toast.POSITION.BOTTOM_CENTER
            });
            return;
        }

        if (res?.status >= 200 && res?.status < 300) {
            reload();
        } else {
            const payload = await res?.json();
            if (payload.type === 'resource_capped') {
                setModalShowSpinner(false);
                setModalTitleColor('text-white');
                setModalTitle('You’ve reached your connections limit!');
                setModalContent(
                    `Scripts are a paid feature. You can only use them with 3 connections or less.
                    Upgrade or delete some connections to activate this script.`
                );
                setModalOkButtonTitle('Upgrade');
                setModalCancelButtonTitle('Learn more');
                setModalOkButtonLink('https://nango.dev/chat');
                setModalCancelButtonLink('https://docs.nango.dev/reference/limits');
                setVisible(true);

                return;
            } else {
                toast.error(payload.error, {
                    position: toast.POSITION.BOTTOM_CENTER
                });
            }
        }
        setModalShowSpinner(false);
        if (setIsEnabling) {
            setIsEnabling(false);
        }
        setVisible(false);
    };

    const onEnableSync = async (flow: Flow) => {
        const flowPayload: ExtendedFlow = {
            provider,
            providerConfigKey,
            type: flow.type,
            name: flow.name,
            runs: flow.runs as string,
            auto_start: flow.auto_start === true,
            track_deletes: flow.track_deletes,
            sync_type: flow.sync_type,
            models: flow.models.map((model) => model.name),
            scopes: flow.scopes,
            input: flow.input,
            returns: flow.returns,
            metadata: {
                description: flow.description,
                scopes: flow.scopes
            },
            endpoints: flow.endpoints,
            output: flow.output,
            pre_built: flow.pre_built,
            is_public: flow.is_public,
            model_schema: JSON.stringify(flow.models),
            public_route: rawName || provider
        };

        if (flow.id) {
            await reEnableFlow({ ...flowPayload, id: flow.id });
        } else {
            await createNewFlow(flowPayload);
        }
    };

    const disableSync = (flow: Flow) => {
        resetModal();

        setModalTitle(`Disable ${flow?.type === 'sync' ? 'sync? (destructive action)' : 'action?'}`);
        setModalTitleColor('text-pink-600');
        const content =
            flow?.type === 'sync'
                ? 'Disabling this sync will result in the deletion of all related synced records potentially for multiple connections. The endpoints to fetch these records will no longer work.'
                : 'This will make the action unavailable for immediate use.';
        setModalContent(content);
        setModalAction(() => () => onDisableSync(flow));
        setVisible(true);
    };

    const onDisableSync = async (flow: Flow) => {
        setModalShowSpinner(true);
        const res = await fetch(`/api/v1/flow/${flow?.id}/disable?env=${env}&sync_name=${flow.name}&connectionIds=${connectionIds.join(',')}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(flow)
        });

        if (res.status === 200) {
            reload();
        } else {
            toast.error('Something went wrong', {
                position: toast.POSITION.BOTTOM_CENTER
            });
        }
        setModalShowSpinner(false);
        setVisible(false);
    };

    const toggleSync = async (flow: Flow) => {
        if (enabled) {
            flow?.type === 'sync' ? await disableSync(flow) : await onDisableSync(flow);
            setEnabled(false);
        } else {
            flow?.type === 'sync' ? await enableSync(flow) : await onEnableSync(flow);
            setEnabled(true);
        }
    };

    return (
        <>
            <ActionModal
                bindings={bindings}
                modalTitle={modalTitle}
                modalContent={modalContent}
                modalAction={modalAction}
                modalShowSpinner={modalShowSpinner}
                modalTitleColor={modalTitleColor}
                setVisible={setVisible}
                modalOkTitle={modalOkButtonTitle}
                modalCancelTitle={modalCancelButtonTitle}
                modalOkLink={modalOkButtonLink}
                modalCancelLink={modalCancelButtonLink}
            />
            {showSpinner && (!('version' in flow) || flow.version === null) && modalShowSpinner && (
                <span className="mr-2">
                    <Spinner size={1} />
                </span>
            )}
            <ToggleButton enabled={enabled} onChange={() => toggleSync(flow)} />
        </>
    );
}
