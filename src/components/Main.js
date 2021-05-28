// @ts-check

import React from 'react';
import PropTypes from 'prop-types';
import Scene, {SceneTypes} from "./Scene/Scene";
import SceneControlBar from "./ControlBar/SceneControlBar";
import SceneEditor, {SceneEditingType} from "./EditingDialog/SceneEditor";
import PlaylistControlBar from "./ControlBar/PlaylistControlBar";
import PlaylistEditor, {PlaylistEditingType} from "./EditingDialog/PlaylistEditor";
import InteractionsBar from "./InteractionsBar/InteractionsBar";
import './Main.scss';
import InteractionEditor, {InteractionEditingType} from "./EditingDialog/InteractionEditor";
import {H5PContext} from "../context/H5PContext";
import {deleteScene, getSceneFromId, setScenePositionFromCamera, updateScene} from "../h5phelpers/sceneParams";
import {updatePlaylist} from "../h5phelpers/playlistParams";
import {isGoToScene, updatePosition} from "../h5phelpers/libraryParams";
import {showConfirmationDialog} from "../h5phelpers/h5pComponents";
import {addBehavioralListeners} from "../h5phelpers/editorForms";

export default class Main extends React.Component {
  /**
   * @param {Object} props
   * @param {number} props.initialScene
   */
  constructor(props) {
    super(props);
    this.props = props;

    this.scenePreview = null;

    this.state = {
      editingScene: SceneEditingType.NOT_EDITING,
      editingPlaylist: PlaylistEditingType.NOT_EDITING,
      editingLibrary: null,
      editingInteraction: InteractionEditingType.NOT_EDITING,
      currentScene: this.props.initialScene,
      startScene: this.props.initialScene,
      isSceneUpdated: false,
      isPlaylistsUpdated: false,
      isSceneSelectorExpanded: false,
      currentCameraPosition: null
    };
  }

  componentDidMount() {
    addBehavioralListeners(this.context.parent, () => {
      this.setState({
        isSceneUpdated: false,
        isPlaylistsUpdated: false,
      });
    });
  }

  editScene(sceneId = SceneEditingType.NEW_SCENE) {
    this.toggleExpandSceneSelector(false);
    this.setState({
      editingScene: sceneId,
    });
  }

  editPlaylist(playlistId = PlaylistEditingType.NEW_PLAYLIST) {
    this.setState({
      editingPlaylist: playlistId,
    });
  }

  updateCurrentScene(deletedSceneId) {
    const hasDeletedCurrentScene = deletedSceneId === this.state.currentScene;
    if (!hasDeletedCurrentScene) {
      return;
    }

    const scenes = this.context.params.scenes;
    if (scenes.length) {
      // Find the first scene that is not current scene and jump to it
      const newScene = scenes[0];
      this.changeScene(newScene.sceneId);
      return;
    }

    // No scenes left
    this.changeScene(SceneTypes.NO_SCENE);
  }

  updateStartScene(deletedSceneId) {
    const hasDeletedStartScene = deletedSceneId === this.state.startScene;
    if (!hasDeletedStartScene) {
      return;
    }

    let startScene = null;
    const scenes = this.context.params.scenes;
    if (scenes.length) {
      const newScene = scenes[0];
      startScene = newScene.sceneId;
    }

    // No scenes left
    this.setStartScene(startScene);
  }

  deleteScene(sceneId) {
    const isNewScene = sceneId === SceneEditingType.NEW_SCENE;
    const deleteSceneText = isNewScene
      ? this.context.t('deleteSceneText')
      : this.context.t('deleteSceneTextWithObjects');

    // Confirm deletion
    showConfirmationDialog({
      headerText: this.context.t('deleteSceneTitle'),
      dialogText: deleteSceneText,
      cancelText: this.context.t('cancel'),
      confirmText: this.context.t('confirm'),
    }, this.confirmedDeleteScene.bind(this, sceneId));
  }

  deletePlaylist(playlistId) {
    const isNewPlaylist = playlistId === PlaylistEditingType.NEW_PLAYLIST;
    const deletePlaylistText = isNewPlaylist
      ? this.context.t('deletePlaylistText')
      : this.context.t('deletePlaylistTextWithObjects');

    // Confirm deletion
    showConfirmationDialog({
      headerText: this.context.t('deletePlaylistTitle'),
      dialogText: deletePlaylistText,
      cancelText: this.context.t('cancel'),
      confirmText: this.context.t('confirm'),
    }, this.confirmedDeletePlaylist.bind(this, playlistId));
  }

  confirmedDeleteScene(sceneId) {
    this.setState({
      editingScene: SceneEditingType.NOT_EDITING,
      isSceneSelectorExpanded: false,
    });

    // Scene not added to params
    const isNewScene = sceneId === SceneEditingType.NEW_SCENE;
    if (isNewScene) {
      return;
    }

    const scenes = this.context.params.scenes;
    const scene = getSceneFromId(scenes, sceneId);
    this.context.params.scenes = deleteScene(scenes, sceneId);

    this.updateCurrentScene(scene.sceneId);
    this.updateStartScene(scene.sceneId);
    this.setState({
      isSceneUpdated: false,
    });
  }

  removePlaylist(playlists, playlistId) {
    if (playlistId > -1) {
      playlists.splice(playlistId, 1);
    }
    return playlists;
  }

  confirmedDeletePlaylist(playlistId) {
    this.setState({
      editingPlaylist: PlaylistEditingType.NOT_EDITING,
    });

    // Playlist not added to params
    const isNewPlaylist = playlistId === PlaylistEditingType.NEW_PLAYLIST;
    if (isNewPlaylist) {
      return;
    }

    const playlists = this.context.params.playlists;
    this.context.params.playlists = this.removePlaylist(playlists, playlistId);

    // Remove playlistId from scenes that are using this playlist
    this.context.params.scenes.forEach(scene => {
      if (scene.playlist === playlistId) {
        scene.playlist = undefined;
      }
    });

    this.setState({
      isPlaylistsUpdated: false
    })
  }

  doneEditingScene(params, editingScene = null, skipChangingScene = false) {
    const scenes = this.context.params.scenes;
    editingScene = editingScene || this.state.editingScene;
    const isEditing = editingScene !== SceneEditingType.NEW_SCENE;

    // Add as start scene if this is the first scene we add
    if (!this.context.params.scenes.length) {
      this.setStartScene(params.sceneId);
    }

    this.context.params.scenes = updateScene(scenes, params, editingScene);

    // Set current scene
    const isChangingScene = !(skipChangingScene || isEditing);

    this.setState((prevState) => {
      return {
        isSceneUpdated: false,
        currentScene: isChangingScene ? params.sceneId : prevState.currentScene,
        editingScene: SceneEditingType.NOT_EDITING,
      };
    });
  }

  doneEditingPlaylist(params, editingPlaylist = null, skipChangingPlaylist = false) {
    const playlists = this.context.params.playlists ? this.context.params.playlists : [];
    editingPlaylist = editingPlaylist || this.state.editingPlaylist;
    const isEditing = editingPlaylist !== PlaylistEditingType.NEW_PLAYLIST;

    this.context.params.playlists = updatePlaylist(playlists, params, editingPlaylist);

    // Set current playlist
    const isChangingPlaylist = !(skipChangingPlaylist || isEditing);

    this.setState((prevState) => {
      return {
        isPlaylistsUpdated: false,
        editingPlaylist: PlaylistEditingType.NOT_EDITING,
      };
    });
  }

  removeInteraction(interactionIndex = null) {
    showConfirmationDialog({
      headerText: this.context.t('deleteInteractionTitle'),
      dialogText: this.context.t('deleteInteractionText'),
      cancelText: this.context.t('cancel'),
      confirmText: this.context.t('confirm'),
    }, this.confirmRemoveInteraction.bind(this, interactionIndex));
  }

  confirmRemoveInteraction(interactionIndex = null) {
    let editingInteraction = interactionIndex;
    if (editingInteraction === null) {
      editingInteraction = this.state.editingInteraction;
    }

    // No interactions has been added yet
    if (editingInteraction === SceneEditingType.NEW_SCENE) {
      this.setState({
        editingInteraction: SceneEditingType.NOT_EDITING,
      });
      return;
    }

    const scenes = this.context.params.scenes;
    const scene = getSceneFromId(scenes, this.state.currentScene);
    scene.interactions.splice(editingInteraction, 1);

    this.setState({
      editingInteraction: SceneEditingType.NOT_EDITING,
      isSceneUpdated: false,
    });
  }

  editInteraction(params, sceneParams = null) {
    // Creating scene as well
    if (sceneParams) {
      this.doneEditingScene(
        sceneParams,
        SceneEditingType.NEW_SCENE,
        true,
      );
    }

    const scenes = this.context.params.scenes;
    const scene = getSceneFromId(scenes, this.state.currentScene);
    if (!scene.interactions) {
      scene.interactions = [];
    }

    const isEditing = this.state.editingInteraction
      !== InteractionEditingType.NEW_INTERACTION;

    let interactionIndex = null;
    if (isEditing) {
      scene.interactions[this.state.editingInteraction] = params;
      interactionIndex = this.state.editingInteraction;
    }
    else {
      scene.interactions.push(params);
      interactionIndex = scene.interactions.length - 1;
    }
    this.scenePreview.trigger('focusInteraction', [interactionIndex, isEditing]);

    this.setState({
      editingInteraction: InteractionEditingType.NOT_EDITING,
      isSceneUpdated: false,
    });
    this.scenePreview.trigger('updateEditStateInteraction');
  }

  changeScene(sceneId) {
    this.setState({
      isSceneUpdated: false,
      currentScene: sceneId,
      isSceneSelectorExpanded: false,
    });
  }

  setStartScene(sceneId) {
    this.context.params.startSceneId = sceneId;
    this.setState({
      startScene: sceneId,
    });
  }

  sceneIsInitialized() {
    this.setState({
      isSceneUpdated: true,
    });
  }

  createInteraction(library) {
    this.setState({
      editingInteraction: InteractionEditingType.NEW_INTERACTION,
      editingLibrary: library,
    });
  }

  /**
   * Handle updating the camera start position when a button is pressed.
   */
  handleSetStartingPosition = () => {
    const camera = this.scenePreview.getCamera().camera;
    setScenePositionFromCamera(
      this.context.params.scenes,
      this.state.currentScene,
      camera
    );
    this.setState({
      currentCameraPosition: camera.yaw + ',' + camera.pitch,
    });
  }

  getInteractionFromIndex(index) {
    const scenes = this.context.params.scenes;
    const scene = getSceneFromId(scenes, this.state.currentScene);
    return scene.interactions[index];
  }

  setScenePreview(scene) {
    this.scenePreview = scene;

    this.scenePreview.off('doubleClickedInteraction');
    this.scenePreview.on('doubleClickedInteraction', (e) => {
      const interactionIndex = e.data;
      const interaction = this.getInteractionFromIndex(interactionIndex);
      if (isGoToScene(interaction)) {
        // @ts-expect-error
        const nextSceneId = parseInt(interaction.action.params.nextSceneId);
        this.changeScene(nextSceneId);
        return;
      }

      this.setState({
        editingInteraction: interactionIndex,
      });
    });

    this.scenePreview.off('goToScene');
    this.scenePreview.on('goToScene', (e) => {
      const interaction = this.getInteractionFromIndex(e.data);
      if (!isGoToScene(interaction)) {
        return;
      }

      // @ts-expect-error
      const nextSceneId = parseInt(interaction.action.params.nextSceneId);
      this.changeScene(nextSceneId);
    });

    this.scenePreview.off('editInteraction');
    this.scenePreview.on('editInteraction', (e) => {
      const interactionIndex = e.data;
      this.setState({
        editingInteraction: interactionIndex,
      });
    });

    this.scenePreview.off('deleteInteraction');
    this.scenePreview.on('deleteInteraction', (e) => {
      this.removeInteraction(e.data);
    });

    this.scenePreview.off('movestop');
    this.scenePreview.on('movestop', e => {
      if (!e.data) {
        return;
      }

      if (e.data.target) {
        const index = this.scenePreview.threeSixty.indexOf(e.data.target);

        // This is an element
        updatePosition(
          this.context.params.scenes,
          this.state.currentScene,
          index,
          e.data
        );
      }
      else {
        // This is the camera
        this.setState({
          currentCameraPosition: e.data.yaw + ',' + e.data.pitch,
        });
      }
    });

    this.scenePreview.on('changedScene', e => {
      this.setState({
        currentScene: e.data,
      });
    });
  }

  toggleExpandSceneSelector(forceState) {
    // Disabled
    if (this.state.currentScene === null) {
      return;
    }

    this.setState((prevState) => {
      const isExpanded = forceState !== undefined
        ? forceState
        : !prevState.isSceneSelectorExpanded;
      return {
        isSceneSelectorExpanded: isExpanded,
      };
    });
  }

  handleCloseSceneOverlay = () => {
    this.toggleExpandSceneSelector(false);
  }

  render() {
    const hasScenes = this.context.params.scenes.length > 0;
    const scene = getSceneFromId(this.context.params.scenes, this.state.currentScene);

    const isInStartingPosition = this.state.currentCameraPosition === null
      || !scene || scene.cameraStartPosition === this.state.currentCameraPosition;

    return (
      <div>
        <div className='scene-editor'>
          <InteractionsBar
            isShowing={this.state.isSceneUpdated && hasScenes}
            createInteraction={this.createInteraction.bind(this)}
          />
          <Scene
            isSceneUpdated={this.state.isSceneUpdated}
            sceneIsInitialized={this.sceneIsInitialized.bind(this)}
            setScenePreview={this.setScenePreview.bind(this)}
            currentScene={this.state.currentScene}
            hasOverlay={this.state.isSceneSelectorExpanded}
            onCloseOverlay={ this.handleCloseSceneOverlay }
          />
        </div>
        <SceneControlBar
          currentScene={this.state.currentScene}
          editScene={this.editScene.bind(this)}
          deleteScene={this.deleteScene.bind(this)}
          newScene={this.editScene.bind(this)}
          changeScene={this.changeScene.bind(this)}
          setStartScene={this.setStartScene.bind(this)}
          startScene={this.state.startScene}
          onSetStartingPosition={ this.handleSetStartingPosition }
          isInStartingPosition={ isInStartingPosition }
          isSceneSelectorExpanded={this.state.isSceneSelectorExpanded}
          toggleExpandSceneSelector={this.toggleExpandSceneSelector.bind(this)}
        />
        {
          // TODO: Refactor to single editor dialog since they can never be shown together
          (this.state.editingScene !== SceneEditingType.NOT_EDITING) &&
          <SceneEditor
            removeAction={this.deleteScene.bind(this, this.state.editingScene)}
            doneAction={this.doneEditingScene.bind(this)}
            editingScene={this.state.editingScene}
          />
        }
        {
          this.state.editingInteraction !== InteractionEditingType.NOT_EDITING &&
          <InteractionEditor
            removeAction={this.removeInteraction.bind(this, this.state.editingInteraction)}
            doneAction={this.editInteraction.bind(this)}
            scenePreview={this.scenePreview}
            currentScene={this.state.currentScene}
            editingInteraction={this.state.editingInteraction}
            library={this.state.editingLibrary}
          />
        }        
        
        <PlaylistControlBar
          editPlaylist={this.editPlaylist.bind(this)}
          newPlaylist={this.editPlaylist.bind(this)}
        />
        {
          (this.state.editingPlaylist !== PlaylistEditingType.NOT_EDITING) &&
          <PlaylistEditor
            removeAction={this.deletePlaylist.bind(this, this.state.editingPlaylist)}
            doneAction={this.doneEditingPlaylist.bind(this)}
            editingPlaylist={this.state.editingPlaylist}
          />
        }
      </div>
    );
  }
}

Main.contextType = H5PContext;

Main.propTypes = {
  initialScene: PropTypes.number,
};
