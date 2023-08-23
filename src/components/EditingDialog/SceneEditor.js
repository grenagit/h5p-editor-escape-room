import React from 'react';
import PropTypes from 'prop-types';
import { editingSceneType } from '../../types/types';
import EditingDialog from './EditingDialog';
import { H5PContext } from '../../context/H5PContext';
import { SceneTypes } from '../Scene/Scene';
import './SceneEditor.scss';
import { getSceneFromId } from '../../h5phelpers/sceneParams';
import { createSceneForm } from '../../h5phelpers/forms/sceneForm';
import { showConfirmationDialog } from '../../h5phelpers/h5pComponents';
import {
  getDefaultSceneParams,
  isInteractionsValid,
  sanitizeSceneForm,
  validateSceneForm
} from '../../h5phelpers/forms/sceneForm';

export const SceneEditingType = {
  NOT_EDITING: null,
  NEW_SCENE: -1,
};

export default class SceneEditor extends React.Component {
  /**
   * @class
   * @param {object} props React props.
   */
  constructor(props) {
    super(props);

    this.semanticsRef = React.createRef();
  }

  /**
   * Get scene parameters.
   * @returns {object} Scene parameters.
   */
  getSceneParams() {
    const scenes = this.context.params.scenes;

    // New scene
    if (this.props.editingScene === SceneEditingType.NEW_SCENE) {
      return getDefaultSceneParams(scenes);
    }

    return getSceneFromId(scenes, this.props.editingScene);
  }

  /**
   * React life-cycle handler: Component did mount.
   */
  componentDidMount() {
    this.params = this.getSceneParams();
    this.wasThreeSixtyScene =
      this.params.sceneType === SceneTypes.THREE_SIXTY_SCENE ||
      this.params.sceneType === SceneTypes.PANORAMA_SCENE;

    // Preserve parent's children
    this.parentChildren = this.context.parent.children;

    createSceneForm(
      this.context.field,
      this.params,
      this.semanticsRef.current,
      this.context.parent
    );

    // Capture own children and restore parent
    this.children = this.context.parent.children;
    this.context.parent.children = this.parentChildren;
  }

  /**
   * Handle done editing form.
   */
  handleDone() {
    const isValid = validateSceneForm(this.children);
    if (!isValid) {
      return;
    }

    if (this.params.playlist && this.params.audioType === 'audio') {
      this.params.playlist = null;
    }

    const { sceneType } = this.params;
    const isThreeSixtyScene = sceneType === SceneTypes.THREE_SIXTY_SCENE || sceneType === SceneTypes.PANORAMA_SCENE;

    if (isInteractionsValid(this.params, isThreeSixtyScene)) {
      this.confirmDone();
      return;
    }

    showConfirmationDialog({
      headerText: this.context.t('changeSceneTitle'),
      dialogText: this.context.t('changeSceneBody'),
      cancelText: this.context.t('cancel'),
      confirmText: this.context.t('confirm'),
    }, this.confirmDone.bind(this));

  }

  /**
   * Handle confirming done editing form.
   */
  confirmDone() {
    const { sceneType } = this.params;
    const isThreeSixtyScene =
      sceneType === SceneTypes.THREE_SIXTY_SCENE ||
      sceneType === SceneTypes.PANORAMA_SCENE;

    sanitizeSceneForm(
      this.params,
      isThreeSixtyScene,
      this.params.cameraStartPosition,
      this.props.previewRect,
      this.wasThreeSixtyScene,
    );

    this.props.doneAction(this.params);
  }

  /**
   * React render function.
   * @returns {object} JSX element.
   */
  render() {
    return (
      <EditingDialog
        title={this.context.t('scene')}
        titleClasses={['scene']}
        removeAction={this.props.removeAction}
        doneAction={this.handleDone.bind(this)}
        doneLabel={this.context.t('done')}
        removeLabel={this.context.t('remove')}
      >
        <div ref={this.semanticsRef} />
      </EditingDialog>
    );
  }
}

SceneEditor.contextType = H5PContext;

SceneEditor.propTypes = {
  editingScene: editingSceneType,
  doneAction: PropTypes.func.isRequired,
  removeAction: PropTypes.func.isRequired,
  previewRect: PropTypes.object.isRequired
};
