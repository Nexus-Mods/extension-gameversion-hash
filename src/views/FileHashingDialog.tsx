import * as React from 'react';
import { Button, ControlLabel, Table } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { ComponentEx, fs, Modal, PureComponentEx, types, util } from 'vortex-api';

import { setShowHashDialog } from '../actions/session';

interface IBaseProps {
  onGenerateHashingEntry: (filePaths: string[]) => void;
}

interface IConnectedProps {
  showDialog: boolean;
}

interface IActionProps {
  onHide: () => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  filePaths: string[];
}

interface IFileEntryProps {
  filePath: string;
  onRemoveFileEntry: (filePath: string) => void;
}

class FileEntry extends PureComponentEx<IFileEntryProps, {}> {
  public render(): JSX.Element {
    const { filePath } = this.props;
    return (
      <tr>
        <td className='cell-actions'>{this.renderStatusActions()}</td>
        <td className='cell-filepath'>{filePath}</td>
      </tr>
    );
  }

  private renderStatusActions(): JSX.Element {
    return (
      <Button onClick={this.remove} >Remove</Button>
    );
  }

  private remove = () => {
    this.props.onRemoveFileEntry(this.props.filePath);
  }
}

class FileHashingDialog extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      filePaths: [],
    });
  }

  public render(): JSX.Element {
    const t = this.context.api.translate;
    const { filePaths } = this.state;

    return (
      <Modal show={this.props.showDialog} onHide={this.hide}>
        <ControlLabel>
          <p>
            {t('Select files for hashing')}
          </p>
        </ControlLabel>
          <div id='gameversion-hash-table-panel'>
            <Table id='gameversion-hash-filepaths-table'>
              <thead>
                <tr>
                  <th className='header-actions'>{t('Actions')}</th>
                  <th className='header-filepath'>{t('File path')}</th>
                </tr>
              </thead>
              <tbody>
                {filePaths.map(this.renderFileEntry)}
              </tbody>
            </Table>
            <Button onClick={this.openFileBrowser}>Add</Button>
            <Button onClick={this.generateHash}>Generate Hash</Button>
          </div>
      </Modal>
    );
  }

  private hide = () => {
    this.nextState.filePaths = [];
    this.props.onHide();
  }

  private addFilePath = (filePath: string) => {
    const filePaths = new Set([].concat(this.state.filePaths, filePath));
    this.nextState.filePaths = Array.from(filePaths);
  }

  private generateHash = () => {
    if (this.state.filePaths.length > 0) {
      this.props.onGenerateHashingEntry(this.state.filePaths);
      this.hide();
    }
  }
  private openFileBrowser = async () => {
    try {
      const selectedPath = await this.context.api.selectFile({
        title: this.context.api.translate('Select file to hash'),
      });
      await fs.statAsync(selectedPath);
      this.addFilePath(selectedPath);
    } catch (err) {
      if (err.code === 'ERR_INVALID_ARG_TYPE') {
        // User canceled or selected nothing.
        return;
      }
      this.context.api.showErrorNotification('Unable to use file for hashing', err.message,
        { allowReport: false });
    }
  }

  private renderFileEntry = (filePath: string): JSX.Element => {
    return (
      <FileEntry
        key={filePath}
        filePath={filePath}
        onRemoveFileEntry={this.removeEntry}
      />);
  }

  private removeEntry = (filePath: string) => {
    const { filePaths } = this.state;
    this.nextState.filePaths = filePaths.filter(f => f !== filePath);
  }
}

function mapStateToProps(state: types.IState, ownProps: any): IConnectedProps {
  return {
    showDialog: util.getSafe(state, ['session', 'gameversion_hashmap', 'showDialog'], false),
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<types.IState, null, Redux.Action>)
    : IActionProps {
  return {
    onHide: () => dispatch(setShowHashDialog(false)),
  };
}

export default withTranslation(['common', 'gameversion-hash'])(
  connect(mapStateToProps, mapDispatchToProps)(
    FileHashingDialog) as any) as React.ComponentType<IBaseProps>;
